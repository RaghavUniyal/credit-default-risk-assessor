import pandas as pd
import numpy as np
import os

def generate_data(num_rows=10000, seed=42):
    """
    Generates a highly realistic credit card portfolio dataset using multivariate
    statistical dependencies, card tier constraints, and Markov chain roll-rate payment status transition matrices.
    """
    np.random.seed(seed)
    
    # 1. Base Customer Details
    customer_ids = [f"CRD{100000 + i}" for i in range(num_rows)]
    
    # Indian names combinatorial pool
    first_names_male = [
        'Aarav', 'Arjun', 'Aditya', 'Vihaan', 'Sai', 'Reyansh', 'Aryan', 'Kabir', 'Rohan', 'Amit', 
        'Sanjay', 'Vikram', 'Anil', 'Rahul', 'Dev', 'Abhishek', 'Pranav', 'Suresh', 'Deepak', 'Gaurav'
    ]
    first_names_female = [
        'Diya', 'Ananya', 'Priya', 'Aadhya', 'Saanvi', 'Kavya', 'Riya', 'Neha', 'Pooja', 'Deepika', 
        'Anjali', 'Kiran', 'Aarti', 'Shweta', 'Jyoti', 'Meera', 'Ritu', 'Komal', 'Radhika', 'Swati'
    ]
    last_names = [
        'Sharma', 'Verma', 'Kumar', 'Singh', 'Patel', 'Shah', 'Gupta', 'Mehta', 'Joshi', 'Rao', 
        'Nair', 'Reddy', 'Pillai', 'Iyer', 'Sen', 'Banerjee', 'Chatterjee', 'Das', 'Mishra', 'Yadav'
    ]
    
    genders = np.random.choice(['M', 'F'], size=num_rows)
    names = []
    for g in genders:
        first = np.random.choice(first_names_male) if g == 'M' else np.random.choice(first_names_female)
        last = np.random.choice(last_names)
        names.append(f"{first} {last}")
        
    ages = np.random.randint(21, 76, size=num_rows)
    
    cities = ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad']
    city_probs = [0.25, 0.22, 0.18, 0.12, 0.10, 0.05, 0.05, 0.03]
    assigned_cities = np.random.choice(cities, size=num_rows, p=city_probs)
    
    # Card Tiers & Networks (Indian Issuer context)
    card_tiers = ['Signature', 'Platinum', 'Gold', 'Classic']
    tier_probs = [0.15, 0.35, 0.30, 0.20]
    assigned_tiers = np.random.choice(card_tiers, size=num_rows, p=tier_probs)
    
    card_networks = ['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI']
    network_probs = [0.45, 0.30, 0.15, 0.10]
    assigned_networks = np.random.choice(card_networks, size=num_rows, p=network_probs)

    # 2. Latent Risk Modeling (Beta distribution for realistic credit risk exposure skewness)
    latent_risk = np.random.beta(a=2, b=6, size=num_rows)  # Skewed left, long tail of high risk

    # 3. Multivariate Credit Metric Generation correlated with Card Tiers and Latent Risk
    # Tiers define the base limits and credit card brackets
    credit_limits = np.zeros(num_rows, dtype=int)
    cibil_scores = np.zeros(num_rows, dtype=int)
    utilization_pct = np.zeros(num_rows)
    dti_pct = np.zeros(num_rows)
    avg_monthly_spend = np.zeros(num_rows)

    for i in range(num_rows):
        tier = assigned_tiers[i]
        risk = latent_risk[i]
        
        # Credit Limits correlated with Card Tier (broadened ranges)
        if tier == 'Signature':
            limit_range = (500000, 2000000)
        elif tier == 'Platinum':
            limit_range = (200000, 750000)
        elif tier == 'Gold':
            limit_range = (100000, 300000)
        else: # Classic
            limit_range = (15000, 100000)
            
        base_limit = np.random.randint(limit_range[0], limit_range[1])
        credit_limits[i] = int(np.round(base_limit / 5000) * 5000)
        
        # CIBIL Score: negative correlation with latent risk (full 300-900 range)
        base_cibil = 900 - (risk * 580) - np.random.normal(0, 18)
        cibil_scores[i] = int(np.clip(base_cibil, 300, 900))
        
        # Utilization Rate: positive correlation with risk (extending up to 95%)
        base_util = (risk * 0.94) + np.random.uniform(0.04, 0.26)
        utilization_pct[i] = float(np.clip(base_util * 100, 0.0, 96.0))
        
        # Debt-to-Income (DTI) ratio: positive correlation with risk (up to 85%)
        base_dti = (risk * 65) + np.random.uniform(10, 32)
        dti_pct[i] = float(np.clip(base_dti, 5.0, 88.0))
        
        # Average monthly spend: correlated with limit and card utilization
        base_spend = credit_limits[i] * (utilization_pct[i] / 100.0) * np.random.uniform(0.12, 0.28)
        avg_monthly_spend[i] = float(np.clip(base_spend, 1000, credit_limits[i] * 0.92))

    # 4. Markov Chain Roll-Rate payment status transitions (M1 to M6)
    # Statuses: Full (0), MAD (1), Late (2), Missed (3)
    states = ['Full', 'MAD', 'Late', 'Missed']
    payment_statuses = np.empty((num_rows, 6), dtype=object)
    
    # We define Transition Matrices (Roll Rates) based on user's latent risk
    for i in range(num_rows):
        risk = latent_risk[i]
        
        # Low risk matrices favor staying 'Full'
        # High risk matrices favor rolling forward to delinquent buckets (Late, Missed)
        if risk < 0.25:
            # Transitions: Full, MAD, Late, Missed
            P = np.array([
                [0.94, 0.05, 0.01, 0.00], # from Full
                [0.85, 0.12, 0.02, 0.01], # from MAD
                [0.70, 0.15, 0.12, 0.03], # from Late
                [0.50, 0.20, 0.15, 0.15]  # from Missed
            ])
        elif risk < 0.55:
            P = np.array([
                [0.80, 0.14, 0.05, 0.01],
                [0.65, 0.22, 0.10, 0.03],
                [0.45, 0.25, 0.20, 0.10],
                [0.30, 0.25, 0.25, 0.20]
            ])
        else: # High Risk
            P = np.array([
                [0.45, 0.30, 0.18, 0.07],
                [0.30, 0.30, 0.25, 0.15],
                [0.15, 0.25, 0.35, 0.25],
                [0.08, 0.12, 0.30, 0.50]
            ])
            
        # Seed M6 payment state
        initial_probs = [max(0.05, 0.95 - (risk * 0.9)), 
                         max(0.02, min(0.35, risk * 0.4)), 
                         max(0.01, min(0.25, risk * 0.3)), 
                         0.0]
        initial_probs[3] = 1.0 - sum(initial_probs[:3])
        initial_state_idx = np.random.choice([0, 1, 2, 3], p=initial_probs)
        payment_statuses[i, 5] = states[initial_state_idx]
        
        # Transition forward from M5 to M1 (recent)
        curr_state_idx = initial_state_idx
        for m in range(4, -1, -1):
            next_state_idx = np.random.choice([0, 1, 2, 3], p=P[curr_state_idx])
            payment_statuses[i, m] = states[next_state_idx]
            curr_state_idx = next_state_idx

    # 5. Sigmoid-Calibrated Default Probability (Basel III risk alignment)
    # Calculate a raw Logit score based on standard credit factors
    default_prob = np.zeros(num_rows)
    for i in range(num_rows):
        # Base logit centered around -4.0 (low baseline default rate)
        # We adjust weights to ensure realistic correlation coefficients
        logit = -0.3
        
        # CIBIL score effect (CIBIL 750+ reduces probability, <650 increases it)
        logit -= (cibil_scores[i] - 700) * 0.007
        
        # Utilization rate effect
        logit += (utilization_pct[i] - 30) * 0.025
        
        # DTI ratio effect
        logit += (dti_pct[i] - 35) * 0.018
        
        # Delinquency Roll-rate count: Missed payments are heavily weighted
        missed_count = sum([1 for m in range(6) if payment_statuses[i, m] == 'Missed'])
        late_count = sum([1 for m in range(6) if payment_statuses[i, m] == 'Late'])
        mad_count = sum([1 for m in range(6) if payment_statuses[i, m] == 'MAD'])
        
        logit += missed_count * 0.95
        logit += late_count * 0.45
        logit += mad_count * 0.12
        
        # Convert to probability using logistic sigmoid function
        p = 1.0 / (1.0 + np.exp(-logit))
        default_prob[i] = p
        
    # Binomial draw from calibrated probabilities to determine default labels
    default_labels = np.random.binomial(1, default_prob)
    
    # 6. Assemble DataFrame and Export
    df = pd.DataFrame({
        'customer_id': customer_ids,
        'customer_name': names,
        'age': ages,
        'city': assigned_cities,
        'card_tier': assigned_tiers,
        'card_network': assigned_networks,
        'cibil_score': cibil_scores,
        'total_credit_limit': credit_limits.astype(int),
        'current_utilization_pct': np.round(utilization_pct, 2),
        'avg_monthly_spend': np.round(avg_monthly_spend, 2),
        'debt_to_income_pct': np.round(dti_pct, 2),
        'payment_status_m1': payment_statuses[:, 0],
        'payment_status_m2': payment_statuses[:, 1],
        'payment_status_m3': payment_statuses[:, 2],
        'payment_status_m4': payment_statuses[:, 3],
        'payment_status_m5': payment_statuses[:, 4],
        'payment_status_m6': payment_statuses[:, 5],
        'default_6month_label': default_labels
    })
    
    return df

if __name__ == "__main__":
    output_dir = "backend/data"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "indian_credit_portfolio_demo.csv")
    
    print("Generating mathematically advanced synthetic credit card portfolio dataset...")
    portfolio_df = generate_data(10000)
    portfolio_df.to_csv(output_path, index=False)
    
    print(f"Dataset successfully created with {len(portfolio_df)} rows.")
    print(f"Saved to: {os.path.abspath(output_path)}")
    
    print("\n--- Calibration Quality Report ---")
    default_rate = portfolio_df['default_6month_label'].mean() * 100
    print(f"Total Default Rate: {default_rate:.2f}% (Basel target: ~3.5%)")
    print(f"Average CIBIL Score: {portfolio_df['cibil_score'].mean():.1f}")
    print(f"Average Utilization: {portfolio_df['current_utilization_pct'].mean():.2f}%")
    
    print("\nDefault Distribution by Card Tier:")
    for tier in ['Signature', 'Platinum', 'Gold', 'Classic']:
        tier_df = portfolio_df[portfolio_df['card_tier'] == tier]
        t_def = tier_df['default_6month_label'].mean() * 100
        print(f"- {tier}: {len(tier_df)} accounts | Default Rate: {t_def:.2f}%")
        
    print("\nDelinquency Bucket distribution:")
    for status in ['Full', 'MAD', 'Late', 'Missed']:
        count = sum(portfolio_df['payment_status_m1'] == status)
        pct = (count / len(portfolio_df)) * 100
        print(f"- M1 Status '{status}': {count} accounts ({pct:.2f}%)")
