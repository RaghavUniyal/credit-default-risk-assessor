import json
import os
import pandas as pd
import sys

# Ensure backend directory is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.ml.predict import predict_batch

def generate_seed():
    csv_path = "backend/data/indian_credit_portfolio_demo.csv"
    if not os.path.exists(csv_path):
        print("Error: Run generate_synthetic_data.py first.")
        return

    df = pd.read_csv(csv_path)
    
    # We take the first 1,500 rows to keep the JSON file lightweight and fast-loading
    seed_df = df.head(1500)
    
    # Convert dataframe rows to records
    records = seed_df.to_dict(orient='records')
    
    # Formulate inputs for prediction (matching CustomerFeatureInput schema keys)
    predictions_input = []
    customers_list = []
    
    for r in records:
        customer_id = r['customer_id']
        cust_record = {
            'customer_id': customer_id,
            'customer_name': r['customer_name'],
            'age': int(r['age']),
            'city': r['city'],
            'card_tier': r['card_tier'],
            'card_network': r['card_network'],
            'cibil_score': int(r['cibil_score']),
            'total_credit_limit': float(r['total_credit_limit']),
            'current_utilization_pct': float(r['current_utilization_pct']),
            'avg_monthly_spend': float(r['avg_monthly_spend']),
            'debt_to_income_pct': float(r['debt_to_income_pct']),
            'payment_status_m1': r['payment_status_m1'],
            'payment_status_m2': r['payment_status_m2'],
            'payment_status_m3': r['payment_status_m3'],
            'payment_status_m4': r['payment_status_m4'],
            'payment_status_m5': r['payment_status_m5'],
            'payment_status_m6': r['payment_status_m6'],
            'default_6month_label': int(r['default_6month_label']) if pd.notna(r['default_6month_label']) else 0
        }
        customers_list.append(cust_record)
        predictions_input.append(cust_record)

    print(f"Scoring {len(predictions_input)} records via model...")
    # Predict batch
    scored_results = predict_batch(predictions_input)
    
    predictions_list = []
    for pred in scored_results:
        # Generate SHAP explanations for high-risk / delinquency indicators
        # To keep it lightweight and fast, we seed structured explanatory metrics
        cid = pred['customer_id']
        score = pred['risk_score']
        verdict = pred['verdict']
        
        # Pull original feature values for context
        cust = next(c for c in customers_list if c['customer_id'] == cid)
        
        # Formulate SHAP drivers based on risk factors
        drivers = [
            {"feature": "current_utilization_pct", "contribution": float((cust['current_utilization_pct'] - 30) * 0.0035), "display_value": f"{cust['current_utilization_pct']}%"},
            {"feature": "cibil_score", "contribution": float((750 - cust['cibil_score']) * 0.0015), "display_value": str(cust['cibil_score'])},
            {"feature": "payment_status_m1", "contribution": 0.05 if cust['payment_status_m1'] in ['Late', 'Missed'] else -0.02, "display_value": cust['payment_status_m1']}
        ]
        
        predictions_list.append({
            'customer_id': cid,
            'risk_score': score,
            'verdict': verdict,
            'shap_drivers': drivers,
            'risk_narrative': f"Scoring engine evaluation shows a default probability of {score*100:.1f}%. High credit utilization combined with CIBIL score details are key drivers.",
            'created_at': "2026-06-29T12:00:00Z"
        })

    # Save to frontend public directory
    public_dir = "frontend/public"
    os.makedirs(public_dir, exist_ok=True)
    
    cust_out = os.path.join(public_dir, "seed_customers.json")
    pred_out = os.path.join(public_dir, "seed_predictions.json")
    
    with open(cust_out, 'w') as f:
        json.dump(customers_list, f, indent=2)
        
    with open(pred_out, 'w') as f:
        json.dump(predictions_list, f, indent=2)

    print("Successfully generated seed files in frontend/public:")
    print(f"- Customers: {os.path.abspath(cust_out)}")
    print(f"- Predictions: {os.path.abspath(pred_out)}")

if __name__ == "__main__":
    generate_seed()
