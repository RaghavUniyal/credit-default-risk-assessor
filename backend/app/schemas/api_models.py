from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional

class CustomerFeatureInput(BaseModel):
    customer_id: str = Field(..., description="Unique customer identifier")
    age: int = Field(..., ge=18, le=100, description="Age of the customer")
    city: str = Field(..., description="City of residence")
    card_tier: str = Field(..., description="Card Tier (Signature, Platinum, Gold, Classic)")
    card_network: str = Field(..., description="Card network (Visa, Mastercard, RuPay, RuPay_UPI)")
    cibil_score: int = Field(..., ge=300, le=900, description="Bureau CIBIL score")
    total_credit_limit: float = Field(..., ge=0, description="Total credit limit in INR")
    current_utilization_pct: float = Field(..., ge=0, le=100, description="Current credit utilization percentage")
    avg_monthly_spend: float = Field(..., ge=0, description="Average monthly card spend in INR")
    debt_to_income_pct: float = Field(..., ge=0, le=100, description="Estimated Debt-to-Income percentage")
    payment_status_m1: str = Field(..., description="Payment status in month 1 (Full, MAD, Late, Missed)")
    payment_status_m2: str = Field(..., description="Payment status in month 2 (Full, MAD, Late, Missed)")
    payment_status_m3: str = Field(..., description="Payment status in month 3 (Full, MAD, Late, Missed)")
    payment_status_m4: str = Field(..., description="Payment status in month 4 (Full, MAD, Late, Missed)")
    payment_status_m5: str = Field(..., description="Payment status in month 5 (Full, MAD, Late, Missed)")
    payment_status_m6: str = Field(..., description="Payment status in month 6 (Full, MAD, Late, Missed)")

class SHAPDriver(BaseModel):
    feature: str = Field(..., description="Feature name")
    contribution: float = Field(..., description="SHAP value indicating the contribution (positive increases risk, negative decreases it)")
    display_value: str = Field(..., description="User-friendly display of feature value")

class PredictionResponse(BaseModel):
    customer_id: str
    risk_score: float = Field(..., description="Continuous default probability between 0.00 and 1.00")
    verdict: str = Field(..., description="Low Risk (PD < 15%), Medium Risk (15% <= PD < 40%), or High Risk (PD >= 40%)")
    shap_drivers: List[SHAPDriver] = Field(..., description="Top 3 drivers of this risk score")
    risk_narrative: Optional[str] = Field(None, description="GenAI narrative of risk factors")
    collection_strategy: Optional[str] = Field(None, description="GenAI collections recommendation")

class SchemaMappingRequest(BaseModel):
    headers: List[str] = Field(..., description="Headers found in the uploaded CSV file")

class SchemaMappingResponse(BaseModel):
    mapping: Dict[str, str] = Field(..., description="Mapping of internal fields to CSV column headers")

class BatchIngestRequest(BaseModel):
    batch_job_id: str
    csv_content: str = Field(..., description="Base64 encoded or raw string CSV data")
    mapping: Dict[str, str] = Field(..., description="Mapping dictionary")
