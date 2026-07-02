import io
import base64
import pandas as pd
import asyncio
from typing import Dict, List, Any
from app.db import get_supabase_client
from app.ml.predict import predict_batch

def suggest_mapping(headers: List[str]) -> Dict[str, str]:
    """
    Analyzes CSV headers and returns a mapping dictionary of internal fields to CSV column headers
    using case-insensitive keyword heuristics.
    """
    mapping = {}
    
    # Internal fields mapped to common CSV variations
    internal_fields = {
        'customer_id': ['customer_id', 'cust_id', 'id', 'customer id', 'cust id', 'pan', 'cardholder_id', 'cardholder id', 'customer_number'],
        'customer_name': ['customer_name', 'name', 'customer name', 'full_name', 'full name', 'cardholder_name', 'cardholder name', 'client_name'],
        'age': ['age', 'customer_age', 'customer age', 'dob', 'birth_year', 'years'],
        'city': ['city', 'location', 'residence', 'address_city', 'home_city', 'tier'],
        'card_tier': ['card_tier', 'tier', 'card tier', 'card_grade', 'grade', 'card grade', 'product_tier', 'product tier'],
        'card_network': ['card_network', 'network', 'card network', 'network_type', 'network_name', 'card_network_type'],
        'cibil_score': ['cibil_score', 'cibil', 'credit_score', 'credit score', 'bureau_score', 'bureau score', 'cibil score'],
        'total_credit_limit': ['total_credit_limit', 'credit_limit', 'limit', 'credit limit', 'total limit', 'card_limit'],
        'current_utilization_pct': ['current_utilization_pct', 'utilization', 'utilization_pct', 'utilization%', 'utilization_rate', 'util%', 'card_utilization'],
        'avg_monthly_spend': ['avg_monthly_spend', 'spend', 'average_spend', 'avg spend', 'monthly_spend', 'spending'],
        'debt_to_income_pct': ['debt_to_income_pct', 'dti', 'debt_to_income', 'debt to income', 'dti_pct', 'dti%'],
        'payment_status_m1': ['payment_status_m1', 'm1', 'm1_payment', 'payment m1', 'status m1', 'payment_status_1'],
        'payment_status_m2': ['payment_status_m2', 'm2', 'm2_payment', 'payment m2', 'status m2', 'payment_status_2'],
        'payment_status_m3': ['payment_status_m3', 'm3', 'm3_payment', 'payment m3', 'status m3', 'payment_status_3'],
        'payment_status_m4': ['payment_status_m4', 'm4', 'm4_payment', 'payment m4', 'status m4', 'payment_status_4'],
        'payment_status_m5': ['payment_status_m5', 'm5', 'm5_payment', 'payment m5', 'status m5', 'payment_status_5'],
        'payment_status_m6': ['payment_status_m6', 'm6', 'm6_payment', 'payment m6', 'status m6', 'payment_status_6'],
        'default_6month_label': ['default_6month_label', 'default', 'default_label', 'label', 'defaulted', 'bad_rate']
    }
    
    for field, synonyms in internal_fields.items():
        for header in headers:
            normalized_header = header.lower().strip().replace('_', ' ').replace('-', ' ')
            matched = False
            for syn in synonyms:
                normalized_syn = syn.lower().replace('_', ' ').replace('-', ' ')
                if normalized_header == normalized_syn or normalized_header == normalized_syn.replace(' ', ''):
                    mapping[field] = header
                    matched = True
                    break
            if matched:
                break
    return mapping

async def process_batch_upload(batch_job_id: str, csv_content_raw: str, mapping: Dict[str, str], user_id: str):
    """
    Asynchronous coroutine that parses the uploaded CSV string, maps it to schema, validates type safety,
    runs ML prediction batch queries, updates Supabase records, and updates real-time ingestion state.
    """
    supabase = get_supabase_client()
    try:
        # Check if Base64 encoded or raw CSV
        try:
            if ';base64,' in csv_content_raw:
                csv_content_raw = csv_content_raw.split(';base64,')[1]
            decoded = base64.b64decode(csv_content_raw).decode('utf-8')
        except Exception:
            decoded = csv_content_raw
            
        # Parse CSV
        df = pd.read_csv(io.StringIO(decoded))
        
        # Verify schema mapping coverage for mandatory fields
        mandatory_fields = [
            'customer_id', 'customer_name', 'age', 'city', 'card_tier', 'card_network', 'cibil_score', 
            'total_credit_limit', 'current_utilization_pct', 'avg_monthly_spend', 'debt_to_income_pct',
            'payment_status_m1', 'payment_status_m2', 'payment_status_m3', 'payment_status_m4', 
            'payment_status_m5', 'payment_status_m6'
        ]
        
        missing_mappings = [field for field in mandatory_fields if field not in mapping]
        if missing_mappings:
            raise ValueError(f"Missing mandatory mappings: {', '.join(missing_mappings)}")
            
        total_rows = len(df)
        
        # Initialize batch state in database
        supabase.table("batch_jobs").update({
            "status": "processing",
            "total_rows": total_rows,
            "processed_rows": 0
        }).eq("id", batch_job_id).execute()
        
        chunk_size = 500
        for start_idx in range(0, total_rows, chunk_size):
            chunk_df = df.iloc[start_idx : start_idx + chunk_size]
            
            chunk_customers = []
            for _, row in chunk_df.iterrows():
                record = {}
                for int_field, csv_header in mapping.items():
                    val = row.get(csv_header)
                    # Handle type casting
                    if int_field in ['age', 'cibil_score']:
                        record[int_field] = int(val) if pd.notna(val) else 0
                    elif int_field in ['total_credit_limit', 'current_utilization_pct', 'avg_monthly_spend', 'debt_to_income_pct']:
                        record[int_field] = float(val) if pd.notna(val) else 0.0
                    elif int_field == 'default_6month_label':
                        record[int_field] = int(val) if pd.notna(val) else None
                    else:
                        record[int_field] = str(val).strip() if pd.notna(val) else ""
                
                # Check formatting boundary checks
                record['card_tier'] = record.get('card_tier', 'Signature')
                if record['card_tier'] not in ['Signature', 'Platinum', 'Gold', 'Classic']:
                    record['card_tier'] = 'Signature'
                    
                record['card_network'] = record.get('card_network', 'Visa')
                if record['card_network'] not in ['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI']:
                    record['card_network'] = 'Visa'
                    
                for m in range(1, 7):
                    pm = f'payment_status_m{m}'
                    if record.get(pm) not in ['Full', 'MAD', 'Late', 'Missed']:
                        record[pm] = 'Full'
                
                record['user_id'] = user_id
                record['batch_job_id'] = batch_job_id
                chunk_customers.append(record)
                
            # Perform ML predict_proba on the chunk
            predictions_output = predict_batch(chunk_customers)
            
            # Batch Insert Customer records into database
            cust_res = supabase.table("customers").insert(chunk_customers).execute()
            
            # Formulate prediction entries
            predictions_to_insert = []
            for pred in predictions_output:
                predictions_to_insert.append({
                    "user_id": user_id,
                    "customer_id": pred["customer_id"],
                    "batch_job_id": batch_job_id,
                    "risk_score": pred["risk_score"],
                    "verdict": pred["verdict"],
                    "shap_drivers": []  # SHAP is lazy-computed on search selection
                })
                
            # Batch Insert Predictions records
            supabase.table("predictions").insert(predictions_to_insert).execute()
            
            # Update Progress status
            processed = min(start_idx + chunk_size, total_rows)
            supabase.table("batch_jobs").update({
                "processed_rows": processed
            }).eq("id", batch_job_id).execute()
            
            # Yield control back to async event loop
            await asyncio.sleep(0.01)
            
        # Mark Ingestion Complete
        import datetime
        supabase.table("batch_jobs").update({
            "status": "completed",
            "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }).eq("id", batch_job_id).execute()
        
    except Exception as e:
        import traceback
        trace_str = traceback.format_exc()
        print(f"Error processing background ingestion job {batch_job_id}: {trace_str}")
        supabase.table("batch_jobs").update({
            "status": "failed",
            "error_message": f"Processing Error: {str(e)}"
        }).eq("id", batch_job_id).execute()
