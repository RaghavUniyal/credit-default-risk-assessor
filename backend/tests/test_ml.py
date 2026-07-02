import sys
import os
import pytest

# Ensure backend directory is in the path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.api_models import CustomerFeatureInput
from app.ml.predict import load_ml_assets, predict_single, predict_batch

@pytest.fixture(scope="module")
def setup_ml():
    # Load ML assets once for tests
    load_ml_assets()

def test_predict_single_low_risk(setup_ml):
    # Setup a mock customer with premium/low-risk metrics (high CIBIL, full payments, low utilization)
    customer = CustomerFeatureInput(
        customer_id="IND_TEST_LOW",
        age=35,
        city="Mumbai",
        card_tier="Signature",
        card_network="Visa",
        cibil_score=850,
        total_credit_limit=500000.0,
        current_utilization_pct=10.0,
        avg_monthly_spend=15000.0,
        debt_to_income_pct=15.0,
        payment_status_m1="Full",
        payment_status_m2="Full",
        payment_status_m3="Full",
        payment_status_m4="Full",
        payment_status_m5="Full",
        payment_status_m6="Full"
    )
    
    result = predict_single(customer)
    
    # Assertions
    assert result["customer_id"] == "IND_TEST_LOW"
    assert isinstance(result["risk_score"], float)
    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["risk_score"] < 0.15  # Should be low risk
    assert result["verdict"] == "Low Risk"
    assert len(result["shap_drivers"]) == 3
    for driver in result["shap_drivers"]:
        assert isinstance(driver.feature, str)
        assert isinstance(driver.contribution, float)
        assert isinstance(driver.display_value, str)

def test_predict_single_high_risk(setup_ml):
    # Setup a mock customer with poor metrics (low CIBIL, missed payments, high utilization)
    customer = CustomerFeatureInput(
        customer_id="IND_TEST_HIGH",
        age=45,
        city="Delhi NCR",
        card_tier="Classic",
        card_network="RuPay",
        cibil_score=400,
        total_credit_limit=100000.0,
        current_utilization_pct=95.0,
        avg_monthly_spend=90000.0,
        debt_to_income_pct=80.0,
        payment_status_m1="Missed",
        payment_status_m2="Missed",
        payment_status_m3="Missed",
        payment_status_m4="Late",
        payment_status_m5="MAD",
        payment_status_m6="Full"
    )
    
    result = predict_single(customer)
    
    # Assertions
    assert result["customer_id"] == "IND_TEST_HIGH"
    assert isinstance(result["risk_score"], float)
    assert 0.0 <= result["risk_score"] <= 1.0
    assert result["risk_score"] >= 0.40  # Should be high risk
    assert result["verdict"] == "High Risk"
    assert len(result["shap_drivers"]) == 3

def test_predict_batch(setup_ml):
    customers = [
        {
            "customer_id": "IND_TEST_B1",
            "age": 30,
            "city": "Bengaluru",
            "card_tier": "Platinum",
            "card_network": "Visa",
            "cibil_score": 750,
            "total_credit_limit": 200000.0,
            "current_utilization_pct": 30.0,
            "avg_monthly_spend": 25000.0,
            "debt_to_income_pct": 25.0,
            "payment_status_m1": "Full",
            "payment_status_m2": "Full",
            "payment_status_m3": "Full",
            "payment_status_m4": "Full",
            "payment_status_m5": "Full",
            "payment_status_m6": "Full"
        },
        {
            "customer_id": "IND_TEST_B2",
            "age": 52,
            "city": "Chennai",
            "card_tier": "Gold",
            "card_network": "Mastercard",
            "cibil_score": 580,
            "total_credit_limit": 50000.0,
            "current_utilization_pct": 85.0,
            "avg_monthly_spend": 40000.0,
            "debt_to_income_pct": 65.0,
            "payment_status_m1": "Missed",
            "payment_status_m2": "MAD",
            "payment_status_m3": "Full",
            "payment_status_m4": "Full",
            "payment_status_m5": "Full",
            "payment_status_m6": "Full"
        }
    ]
    
    results = predict_batch(customers)
    
    assert len(results) == 2
    assert results[0]["customer_id"] == "IND_TEST_B1"
    assert results[1]["customer_id"] == "IND_TEST_B2"
    assert isinstance(results[0]["risk_score"], float)
    assert isinstance(results[1]["risk_score"], float)
    assert results[0]["verdict"] in ["Low Risk", "Medium Risk", "High Risk"]
    assert results[1]["verdict"] in ["Low Risk", "Medium Risk", "High Risk"]

def test_suggest_mapping():
    from app.services.ingestion import suggest_mapping
    headers = [
        "cust_id", "Age", "Home-City", "tier", "network", 
        "cibil score", "credit_limit", "utilization%", "spend", "DTI",
        "m1", "m2", "m3", "m4", "m5", "m6", "defaulted"
    ]
    mapping = suggest_mapping(headers)
    
    assert mapping["customer_id"] == "cust_id"
    assert mapping["age"] == "Age"
    assert mapping["city"] == "Home-City"
    assert mapping["card_tier"] == "tier"
    assert mapping["cibil_score"] == "cibil score"
    assert mapping["current_utilization_pct"] == "utilization%"
    assert mapping["debt_to_income_pct"] == "DTI"
    assert mapping["payment_status_m1"] == "m1"
    assert mapping["default_6month_label"] == "defaulted"

