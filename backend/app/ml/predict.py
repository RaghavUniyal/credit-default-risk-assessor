import joblib
import os
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from app.schemas.api_models import CustomerFeatureInput, SHAPDriver
from app.config import settings

# Global ML models cache
_model = None
_preprocessor = None
_explainer = None

def load_ml_assets():
    """
    Loads machine learning assets into memory.
    Ensures assets are loaded exactly once during application life-cycle.
    """
    global _model, _preprocessor, _explainer
    
    if _model is None:
        # Determine correct paths based on workspace configuration
        model_path = settings.MODEL_PATH if os.path.exists(settings.MODEL_PATH) else "backend/app/ml/model.joblib"
        explainer_path = settings.EXPLAINER_PATH if os.path.exists(settings.EXPLAINER_PATH) else "backend/app/ml/explainer.joblib"
        preprocessor_path = "backend/app/ml/preprocessor.joblib" if os.path.exists("backend/app/ml/preprocessor.joblib") else "app/ml/preprocessor.joblib"
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Train the model first.")
            
        print(f"Loading ML model from {model_path}...")
        _model = joblib.load(model_path)
        
        print(f"Loading preprocessor states from {preprocessor_path}...")
        _preprocessor = joblib.load(preprocessor_path)
        
        print(f"Loading SHAP explainer from {explainer_path}...")
        try:
            _explainer = joblib.load(explainer_path)
        except Exception as e:
            print(f"Warning: Failed to load SHAP explainer from file ({e}). Rebuilding tree explainer...")
            import shap
            _explainer = shap.TreeExplainer(_model)

def map_feature_name(col: str) -> str:
    """
    Maps raw feature columns to beautiful, B2B user-friendly names.
    """
    if col.startswith('city_'):
        return "City of Residence"
    if col.startswith('card_tier_'):
        return "Card Tier"
    if col.startswith('card_network_'):
        return "Card Network"
        
    friendly_names = {
        'age': 'Customer Age',
        'cibil_score': 'Bureau CIBIL Score',
        'total_credit_limit': 'Total Credit Limit',
        'current_utilization_pct': 'Credit Utilization',
        'avg_monthly_spend': 'Avg Monthly Spend',
        'debt_to_income_pct': 'Debt-to-Income Ratio (DTI)',
        'payment_status_m1': 'Recent Payment Status (M-1)',
        'payment_status_m2': 'Payment Status (M-2)',
        'payment_status_m3': 'Payment Status (M-3)',
        'payment_status_m4': 'Payment Status (M-4)',
        'payment_status_m5': 'Payment Status (M-5)',
        'payment_status_m6': 'Payment Status (M-6)',
    }
    return friendly_names.get(col, col)

def map_display_value(col: str, orig_val: Any) -> str:
    """
    Formats the raw value of a feature to a premium, readable format.
    """
    if col.startswith('city_'):
        return str(orig_val)
    if col.startswith('card_tier_'):
        return str(orig_val)
    if col.startswith('card_network_'):
        return str(orig_val).replace('_', ' ')
        
    if col in ['total_credit_limit', 'avg_monthly_spend']:
        try:
            return f"INR {float(orig_val):,.0f}"
        except Exception:
            return f"INR {orig_val}"
            
    if col in ['current_utilization_pct', 'debt_to_income_pct']:
        try:
            return f"{float(orig_val):.1f}%"
        except Exception:
            return f"{orig_val}%"
            
    if col == 'cibil_score':
        return str(orig_val)
        
    if col == 'age':
        return f"{orig_val} Yrs"
        
    return str(orig_val)

def preprocess_features(inputs: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Transforms a list of raw customer dictionaries into the exact formatted columns
    needed for the XGBoost model.
    """
    load_ml_assets()
    
    df = pd.DataFrame(inputs)
    
    # 1. Map payment statuses to ordinal integers
    payment_cols = _preprocessor['payment_cols']
    payment_mapping = _preprocessor['payment_mapping']
    for col in payment_cols:
        if col in df.columns:
            df[col] = df[col].map(payment_mapping)
            
    # 2. Extract and one-hot encode categoricals
    cat_cols = _preprocessor['cat_cols']
    encoder = _preprocessor['encoder']
    
    encoded_cats = encoder.transform(df[cat_cols])
    encoded_cat_names = encoder.get_feature_names_out(cat_cols)
    encoded_cats_df = pd.DataFrame(encoded_cats, columns=encoded_cat_names, index=df.index)
    
    # 3. Concatenate and drop original columns
    df_processed = df.drop(columns=cat_cols).join(encoded_cats_df)
    
    # 4. Align columns with training feature set order (padding any missing with 0)
    feature_names = _preprocessor['feature_names']
    df_final = df_processed.reindex(columns=feature_names, fill_value=0)
    
    return df_final

def predict_single(input_data: CustomerFeatureInput) -> Dict[str, Any]:
    """
    Preprocesses a single customer record, predicts the continuous default probability,
    maps to risk verdict, and calculates the top 3 SHAP driver features.
    """
    load_ml_assets()
    
    input_dict = input_data.model_dump()
    customer_id = input_dict.pop('customer_id')
    
    # Preprocess
    x_processed = preprocess_features([input_dict])
    
    # Predict continuous float probability of default
    risk_score = float(_model.predict_proba(x_processed)[0, 1])
    
    # Determine risk verdict band
    if risk_score < 0.15:
        verdict = "Low Risk"
    elif risk_score < 0.40:
        verdict = "Medium Risk"
    else:
        verdict = "High Risk"
        
    # Calculate SHAP values
    shap_explanation = _explainer(x_processed)
    shap_vals = shap_explanation.values[0]
    
    drivers = []
    for col in x_processed.columns:
        val_contrib = float(shap_vals[x_processed.columns.get_loc(col)])
        
        # Determine original display value
        is_cat = col.startswith('city_') or col.startswith('card_tier_') or col.startswith('card_network_')
        if is_cat:
            # For one-hot columns, only explain if it is active (value == 1.0)
            if x_processed[col].iloc[0] != 1.0:
                continue
            orig_val = col.split('_', 1)[1]
        else:
            # We map ordinal values back to display labels for payment statuses
            raw_val = input_dict.get(col)
            orig_val = raw_val
            
        display_name = map_feature_name(col)
        display_value = map_display_value(col, orig_val)
        
        drivers.append(SHAPDriver(
            feature=display_name,
            contribution=val_contrib,
            display_value=display_value
        ))
        
    # Sort drivers by absolute impact (descending) and return top 3
    drivers.sort(key=lambda d: abs(d.contribution), reverse=True)
    top_3 = drivers[:3]
    
    # Generate GenAI Risk Narrative
    from app.services.gemini import generate_risk_narrative
    # We pass the full customer record including name and id for descriptive context
    full_cust_details = input_dict.copy()
    full_cust_details['customer_id'] = customer_id
    narrative = generate_risk_narrative(full_cust_details, risk_score, verdict)
    
    return {
        "customer_id": customer_id,
        "risk_score": risk_score,
        "verdict": verdict,
        "shap_drivers": top_3,
        "risk_narrative": narrative
    }

def predict_batch(inputs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Helper function to score an array of customer inputs efficiently.
    Returns customer ID, risk score, and verdict (excluding SHAP for batch performance,
    unless requested).
    """
    load_ml_assets()
    
    # Store IDs
    customer_ids = [row['customer_id'] for row in inputs]
    
    # Prepare batch features (remove id)
    features_list = []
    for row in inputs:
        feat = row.copy()
        feat.pop('customer_id', None)
        features_list.append(feat)
        
    x_processed = preprocess_features(features_list)
    
    # Batch predict probabilities
    probs = _model.predict_proba(x_processed)[:, 1]
    
    results = []
    for cid, score in zip(customer_ids, probs):
        float_score = float(score)
        if float_score < 0.15:
            verdict = "Low Risk"
        elif float_score < 0.40:
            verdict = "Medium Risk"
        else:
            verdict = "High Risk"
            
        results.append({
            "customer_id": cid,
            "risk_score": float_score,
            "verdict": verdict
        })
        
    return results
