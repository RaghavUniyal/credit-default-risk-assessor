import pandas as pd
import numpy as np
import xgboost as xgb
import shap
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report

def train_model():
    # 1. Load Data
    csv_path = "backend/data/indian_credit_portfolio_demo.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset not found at {csv_path}. Run synthetic data script first.")
        
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} rows from {csv_path}")

    # 2. Separate Features and Label
    X = df.drop(columns=['customer_id', 'customer_name', 'default_6month_label'])
    y = df['default_6month_label']

    # 3. Preprocess Categorical & Payment Status columns
    # Map payment statuses ordinally: Full=0, MAD=1, Late=2, Missed=3
    payment_cols = [f'payment_status_m{i}' for i in range(1, 7)]
    payment_mapping = {'Full': 0, 'MAD': 1, 'Late': 2, 'Missed': 3}
    
    for col in payment_cols:
        X[col] = X[col].map(payment_mapping)

    # One-Hot Encode nominal categoricals (city, bank, card_network)
    cat_cols = ['city', 'primary_bank', 'card_network']
    
    encoder = OneHotEncoder(handle_unknown='ignore', sparse_output=False)
    encoded_cats = encoder.fit_transform(X[cat_cols])
    encoded_cat_names = encoder.get_feature_names_out(cat_cols)
    
    # Create DataFrame from encoded categoricals
    encoded_cats_df = pd.DataFrame(encoded_cats, columns=encoded_cat_names, index=X.index)
    
    # Drop original nominal categoricals and concat the encoded ones
    X_processed = X.drop(columns=cat_cols).join(encoded_cats_df)
    
    # 4. Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X_processed, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Training features shape: {X_train.shape}")

    # 5. Train XGBoost Classifier
    # We want a model calibrated for probabilities, XGBoost handles predict_proba directly.
    model = xgb.XGBClassifier(
        n_estimators=150,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        eval_metric='logloss'
    )
    
    model.fit(X_train, y_train)
    
    # 6. Evaluate Model
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)
    
    print("\n--- Model Evaluation ---")
    print(f"Accuracy: {acc:.4f}")
    print(f"ROC AUC Score: {auc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred))

    # 7. Setup SHAP Explainer
    # We fit SHAP TreeExplainer to explain prediction risk factors
    print("Fitting SHAP TreeExplainer...")
    explainer = shap.TreeExplainer(model)

    # 8. Save artifacts
    ml_dir = "backend/app/ml"
    os.makedirs(ml_dir, exist_ok=True)
    
    # We save the model, the encoder metadata (to replicate transformations on input), and the SHAP explainer
    model_path = os.path.join(ml_dir, "model.joblib")
    explainer_path = os.path.join(ml_dir, "explainer.joblib")
    preprocessor_path = os.path.join(ml_dir, "preprocessor.joblib")

    # Preprocessor state dict
    preprocessor_state = {
        'encoder': encoder,
        'cat_cols': cat_cols,
        'payment_cols': payment_cols,
        'payment_mapping': payment_mapping,
        'feature_names': list(X_processed.columns)
    }

    joblib.dump(model, model_path)
    joblib.dump(explainer, explainer_path)
    joblib.dump(preprocessor_state, preprocessor_path)
    
    print("\nArtifacts saved successfully:")
    print(f"- Model: {os.path.abspath(model_path)}")
    print(f"- Explainer: {os.path.abspath(explainer_path)}")
    print(f"- Preprocessor State: {os.path.abspath(preprocessor_path)}")

if __name__ == "__main__":
    train_model()
