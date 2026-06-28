import pandas as pd
import numpy as np
import os

def generate_data(num_rows=10000, seed=42):
    np.random.seed(seed)
    
    # 1. Base details
    customer_ids = [f"IND{100000 + i}" for i in range(num_rows)]
    
    # Combinatorial Indian Name Generator
    first_names_male = [
        'Aarav', 'Arjun', 'Aditya', 'Vihaan', 'Sai', 'Reyansh', 'Aryan', 'Kabir', 'Rohan', 'Amit', 
        'Sanjay', 'Vikram', 'Rajesh', 'Anil', 'Sunil', 'Vijay', 'Rahul', 'Dev', 'Manish', 'Alok', 
        'Abhishek', 'Pranav', 'Suresh', 'Ramesh', 'Harish', 'Karan', 'Deepak', 'Nikhil', 'Gaurav', 'Sandeep'
    ]
    first_names_female = [
        'Diya', 'Ananya', 'Priya', 'Aadhya', 'Saanvi', 'Kavya', 'Riya', 'Neha', 'Pooja', 'Deepika', 
        'Anjali', 'Kiran', 'Sunita', 'Aarti', 'Shweta', 'Nisha', 'Jyoti', 'Meera', 'Ritu', 'Komal', 
        'Divya', 'Sushma', 'Preeti', 'Priyanka', 'Radhika', 'Swati', 'Kajal', 'Sapna', 'Poonam', 'Anisha'
    ]
    last_names = [
        'Sharma', 'Verma', 'Kumar', 'Singh', 'Patel', 'Shah', 'Gupta', 'Mehta', 'Joshi', 'Rao', 
        'Nair', 'Reddy', 'Pillai', 'Iyer', 'Sen', 'Banerjee', 'Chatterjee', 'Das', 'Mishra', 'Choudhury', 
        'Bhat', 'Kulkarni', 'Deshmukh', 'Yadav', 'Trivedi', 'Pandey', 'Saxena', 'Kapoor', 'Khanna', 'Gill',
        'Jha', 'Chawla', 'Malhotra', 'Mehra', 'Bose', 'Mukherjee', 'Dubey', 'Shukla', 'Prasad', 'Naidu'
    ]
    
    # Assign names
    genders = np.random.choice(['M', 'F'], size=num_rows)
    names = []
    for g in genders:
        first = np.random.choice(first_names_male) if g == 'M' else np.random.choice(first_names_female)
        last = np.random.choice(last_names)
        names.append(f"{first} {last}")
        
    ages = np.random.randint(21, 66, size=num_rows)
    
    cities = ['Mumbai', 'Delhi NCR', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow']
    city_probs = [0.22, 0.20, 0.18, 0.10, 0.10, 0.06, 0.06, 0.04, 0.02, 0.02]
    assigned_cities = np.random.choice(cities, size=num_rows, p=city_probs)
    
    banks = ['HDFC', 'ICICI', 'SBI', 'Axis', 'Yes Bank']
    bank_probs = [0.30, 0.25, 0.20, 0.15, 0.10]
    assigned_banks = np.random.choice(banks, size=num_rows, p=bank_probs)
    
    card_networks = ['Visa', 'Mastercard', 'RuPay', 'RuPay_UPI']
    network_probs = [0.40, 0.30, 0.15, 0.15]
    assigned_networks = np.random.choice(card_networks, size=num_rows, p=network_probs)

    # 2. Financial Metrics (utilization, limit, spending)
    base_limits = np.random.choice([50000, 100000, 250000, 500000, 1000000, 1500000], size=num_rows, p=[0.25, 0.35, 0.20, 0.12, 0.06, 0.02])
    credit_limits = base_limits * np.random.uniform(0.9, 1.1, size=num_rows)
    credit_limits = np.round(credit_limits / 5000) * 5000  # Round to nearest 5k

    # Current utilization correlated with risk factors
    latent_risk = np.random.beta(a=2, b=5, size=num_rows) 
    
    # CIBIL score (300-900)
    cibil_scores = 900 - (latent_risk * 550) - np.random.normal(0, 25, size=num_rows)
    cibil_scores = np.clip(cibil_scores, 300, 900).astype(int)

    # Utilization %
    utilization_pct = (latent_risk * 0.85) + np.random.uniform(0.05, 0.25, size=num_rows)
    utilization_pct = np.clip(utilization_pct * 100, 0.0, 100.0)

    # Avg monthly spend
    avg_monthly_spend = credit_limits * (utilization_pct / 100.0) * np.random.uniform(0.1, 0.3, size=num_rows)
    avg_monthly_spend = np.clip(avg_monthly_spend, 2000, credit_limits * 0.95)
    
    # Debt-to-Income % (DTI)
    dti_pct = (latent_risk * 60) + np.random.uniform(10, 30, size=num_rows)
    dti_pct = np.clip(dti_pct, 10.0, 95.0)

    # 3. Behavioral Payment Timeline (M1 to M6)
    payment_statuses = np.empty((num_rows, 6), dtype=object)
    status_options = ['Full', 'MAD', 'Late', 'Missed']
    
    for i in range(num_rows):
        risk = latent_risk[i]
        p_full = max(0.1, 0.95 - (risk * 0.8))
        p_mad = max(0.02, min(0.35, risk * 0.4))
        p_late = max(0.01, min(0.25, risk * 0.2))
        p_missed = 1.0 - (p_full + p_mad + p_late)
        
        probs = [p_full, p_mad, p_late, p_missed]
        
        for m in range(5, -1, -1): 
            adjusted_probs = probs.copy()
            if m < 5 and payment_statuses[i, m+1] in ['Late', 'Missed']:
                adjusted_probs[3] += 0.25
                adjusted_probs[2] += 0.10
                adjusted_probs[0] -= 0.35
                adjusted_probs = np.clip(adjusted_probs, 0.001, 1.0)
                adjusted_probs /= adjusted_probs.sum()
                
            payment_statuses[i, m] = np.random.choice(status_options, p=adjusted_probs)

    # 4. Generate Default Label (6-Month Default Probability)
    default_prob = np.zeros(num_rows)
    for i in range(num_rows):
        p = latent_risk[i] * 0.6
        if cibil_scores[i] < 550:
            p += 0.25
        elif cibil_scores[i] > 750:
            p -= 0.15
            
        if utilization_pct[i] > 80:
            p += 0.20
        elif utilization_pct[i] < 30:
            p -= 0.10
            
        if dti_pct[i] > 60:
            p += 0.15
            
        missed_count_recent = sum([1 for m in range(3) if payment_statuses[i, m] == 'Missed'])
        late_count_recent = sum([1 for m in range(3) if payment_statuses[i, m] == 'Late'])
        mad_count_recent = sum([1 for m in range(3) if payment_statuses[i, m] == 'MAD'])
        
        p += missed_count_recent * 0.25
        p += late_count_recent * 0.12
        p += mad_count_recent * 0.05
        
        missed_total = sum([1 for m in range(6) if payment_statuses[i, m] == 'Missed'])
        p += missed_total * 0.05
        p = np.clip(p, 0.01, 0.99)
        default_prob[i] = p

    default_labels = np.random.binomial(1, default_prob)

    # 5. Create DataFrame and export
    df = pd.DataFrame({
        'customer_id': customer_ids,
        'customer_name': names,
        'age': ages,
        'city': assigned_cities,
        'primary_bank': assigned_banks,
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
    
    print("Generating synthetic Indian credit portfolio dataset with names...")
    portfolio_df = generate_data(10000)
    portfolio_df.to_csv(output_path, index=False)
    
    print(f"Dataset successfully created with {len(portfolio_df)} rows.")
    print(f"Saved to: {os.path.abspath(output_path)}")
    print("\nSample Statistics:")
    print(f"Total Default Rate: {portfolio_df['default_6month_label'].mean() * 100:.2f}%")
    print(f"Average CIBIL Score: {portfolio_df['cibil_score'].mean():.1f}")
    print(f"Average Credit Limit: INR {portfolio_df['total_credit_limit'].mean():,.2f}")
    print(f"Average Current Utilization: {portfolio_df['current_utilization_pct'].mean():.2f}%")
