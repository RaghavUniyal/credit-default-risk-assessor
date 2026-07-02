import google.generativeai as genai
import asyncio
from typing import AsyncGenerator, Dict, Any
from app.config import settings

# Initialize GenAI
try:
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY != "your-gemini-api-key":
        genai.configure(api_key=settings.GEMINI_API_KEY)
    else:
        print("Warning: GEMINI_API_KEY is not configured. GenAI functions will return mock data.")
except Exception as e:
    print(f"Error configuring Gemini API: {e}")

def generate_risk_narrative(customer_details: Dict[str, Any], risk_score: float, verdict: str) -> str:
    """
    Generates a concise 2-sentence plain English risk narrative referencing the customer's
    credit details, CIBIL, and continuous PD percentage.
    """
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your-gemini-api-key":
        # Graceful fallback
        pd_pct = risk_score * 100
        return (
            f"This customer exhibits a {pd_pct:.1f}% 6-month Probability of Default, resulting in a {verdict} status. "
            f"Primary risk drivers include a CIBIL score of {customer_details.get('cibil_score')} and recent payments categorized as {customer_details.get('payment_status_m1')}."
        )

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        prompt = f"""
        Analyze the following credit card holder details and provide a professional, objective 2-sentence risk narrative.
        You must reference the continuous Probability of Default (PD) of {risk_score * 100:.2f}% and the verdict of {verdict}.
        
        Customer details:
        - Age: {customer_details.get('age')}
        - CIBIL Score: {customer_details.get('cibil_score')}
        - Primary Bank: {customer_details.get('primary_bank')}
        - Card Network: {customer_details.get('card_network')}
        - Credit Limit: INR {customer_details.get('total_credit_limit')}
        - Utilization: {customer_details.get('current_utilization_pct')}%
        - Debt-to-Income: {customer_details.get('debt_to_income_pct')}%
        - Payment Status M1 (Recent) to M3: {customer_details.get('payment_status_m1')}, {customer_details.get('payment_status_m2')}, {customer_details.get('payment_status_m3')}
        
        Prompt:
        Identify the main risk drivers and write exactly two sentences in plain English explaining their default risk. Do not use bullet points or markdown.
        """
        
        response = model.generate_content(prompt)
        text = response.text.strip().replace("\n", " ")
        return text
    except Exception as e:
        print(f"Gemini narrative generation error: {e}")
        pd_pct = risk_score * 100
        return (
            f"Default risk is evaluated at {pd_pct:.1f}% ({verdict}). "
            f"Risk indicators show CIBIL at {customer_details.get('cibil_score')} and card utilization at {customer_details.get('current_utilization_pct')}%."
        )

async def stream_collections_strategy(customer_details: Dict[str, Any], risk_score: float, verdict: str) -> AsyncGenerator[str, None]:
    """
    Streams a targeted credit collections strategy based on the customer's risk band.
    Yields data for Server-Sent Events (SSE).
    """
    system_instruction = (
        "You are an expert Collections Strategist for an Indian Bank. Suggest a targeted credit card collections strategy based on the customer's credit metrics, CIBIL score, recent payment history, and their 6-month Probability of Default (PD). "
        "Guidelines:\n"
        "- Under 15% PD (Low Risk): Suggest standard digital communication (SMS, Whatsapp), auto-pay activation, and soft notifications.\n"
        "- 15% to 40% PD (Medium Risk): Recommend early intervention, offering 3-to-6 month EMI conversion, and calling 2 days post-due.\n"
        "- 40% to 70% PD (High Risk): Suggest card blocking, daily contact, offering loan restructuring, or customized repayments.\n"
        "- Above 70% PD (High Risk): Immediate assignment to field collections, external recovery agencies, and legal notices under Section 138 if cheques bounce.\n"
        "Write a short, highly actionable strategy with bullet points, formatted in markdown. Limit to 3 points."
    )
    
    prompt = f"""
    Provide collections recommendations for this cardholder:
    - Customer ID: {customer_details.get('customer_id')}
    - Continuous PD: {risk_score * 100:.2f}% ({verdict})
    - CIBIL Score: {customer_details.get('cibil_score')}
    - Credit Limit: INR {customer_details.get('total_credit_limit')}
    - Card Utilization: {customer_details.get('current_utilization_pct')}%
    - Recent Payment Delinquencies: M1={customer_details.get('payment_status_m1')}, M2={customer_details.get('payment_status_m2')}
    """

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your-gemini-api-key":
        # Mock streaming
        mock_response = [
            f"### Actionable Collections Strategy (PD: {risk_score * 100:.1f}%)\n\n",
            f"1. **Risk Tier: {verdict} Intervention**: ",
            "Send customized automated WhatsApp alerts and place soft IVR calls reminding them of repayment options.\n",
            "2. **EMI Offer**: " if risk_score >= 0.15 else "2. **Account Monitoring**: ",
            "Proactively offer a 3-month EMI conversion for outstanding balances to ease cash flow.\n" if risk_score >= 0.15 else "Monitor utilization spikes closely and ensure autopay links are verified.\n",
            "3. **Credit Limit Action**: " if risk_score >= 0.40 else "3. **Standard Reminders**: ",
            "Temporarily restrict further transactions on this card and flag for immediate outbound tele-caller contact." if risk_score >= 0.40 else "Maintain standard monthly cycle payment notifications."
        ]
        for chunk in mock_response:
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.1)
        yield "data: [DONE]\n\n"
        return

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )
        response = model.generate_content(prompt, stream=True)
        
        for chunk in response:
            if chunk.text:
                # Format to SSE style
                yield f"data: {chunk.text}\n\n"
                await asyncio.sleep(0.02)
        yield "data: [DONE]\n\n"
    except Exception as e:
        print(f"Gemini Collections strategy streaming error: {e}")
        yield f"data: Error: {str(e)}\n\n"
        yield "data: [DONE]\n\n"

async def stream_regulatory_simulation(query: str, portfolio_stats: Dict[str, Any]) -> AsyncGenerator[str, None]:
    """
    Streams the regulatory simulation chat response, injecting RBI contexts and portfolio statistics.
    """
    summary_text = (
        f"Total Ingested Customers: {portfolio_stats.get('total_customers', 10000)}\n"
        f"Average Portfolio PD: {portfolio_stats.get('avg_pd', 0.32) * 100:.2f}%\n"
        f"Average CIBIL Score: {portfolio_stats.get('avg_cibil', 742.0):.1f}\n"
        f"Risk Breakdown: Low Risk ({portfolio_stats.get('low_risk_pct', 40.0):.1f}%), "
        f"Medium Risk ({portfolio_stats.get('med_risk_pct', 30.0):.1f}%), "
        f"High Risk ({portfolio_stats.get('high_risk_pct', 30.0):.1f}%)\n"
        f"Portfolio Tiers exposure: Signature ({portfolio_stats.get('tier_signature', 15)}%), Platinum ({portfolio_stats.get('tier_platinum', 35)}%)\n"
        f"Unsecured Credit Card Limit Exposure: INR {portfolio_stats.get('total_limit', 2500000000):,}"
    )

    system_instruction = (
        "You are an elite Banking Compliance and Risk Advisory Consultant for Indian Banks and NBFCs. "
        "You are helping a Risk Officer understand the impact of regulatory guidelines on their portfolio. "
        "Regulatory Context:\n"
        "RBI (Reserve Bank of India) has increased risk weights on unsecured consumer loans and credit card receivables by 25 percentage points, raising them from 125% to 150% for commercial banks, and to 125% for NBFCs. "
        "This forces banks to hold more risk-weighted assets (RWA) and capital, impacting the Capital Adequacy Ratio (CAR) and increasing the cost of funds. "
        "Furthermore, RBI mandates stricter credit limits, tighter underwriting, and heightened provisioning for stress accounts (SMA-0/1/2).\n\n"
        "Portfolio Statistics under review:\n"
        f"{summary_text}\n\n"
        "Guidelines:\n"
        "- Analyze the user query specifically against this portfolio overview and the RBI regulatory guidelines.\n"
        "- Provide quantitative estimations or analytical insights (e.g., how the risk weight increase shifts their Capital requirements or how high-risk buckets require provisioning).\n"
        "- Maintain a highly professional, authoritative, and strategic risk-consultant tone.\n"
        "- Respond in markdown."
    )

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your-gemini-api-key":
        # Mock streaming for regulatory simulation
        mock_chunks = [
            "### RBI Risk Weight Increase Simulation\n\n",
            "Based on the **Reserve Bank of India (RBI)** recent mandate increasing risk weights on credit card receivables by 25% (from 125% to 150%), here is an analysis of the impact on your uploaded portfolio:\n\n",
            "#### 1. Capital Adequacy Ratio (CAR) Impact\n",
            f"Your portfolio has a total unsecured credit card exposure of **INR {portfolio_stats.get('total_limit', 2500000000):,}**. ",
            f"Under the old 125% weight, Risk Weighted Assets (RWA) were INR {portfolio_stats.get('total_limit', 2500000000) * 1.25:,.2f}.\n",
            f"Under the new 150% weight, your RWA increases to **INR {portfolio_stats.get('total_limit', 2500000000) * 1.5:,.2f}**. This represents a capital requirement hike, which will suppress your CAR by approximately **1.2% - 1.5%** depending on your Tier-1 equity base.\n\n",
            "#### 2. Provisioning & Stress Segment (High Risk)\n",
            f"With **{portfolio_stats.get('high_risk_pct', 30.0):.1f}%** of your portfolio flagged as **High Risk** (average PD > 40%), these accounts represent critical exposure. ",
            "Stricter underwriting limits must be deployed to block credit extension for this bucket, as higher risk weights raise the cost of capital allocation on stressed loans.\n\n",
            "#### 3. Recommended Actions\n",
            "- **De-risk Exposure**: Reduce credit limits on accounts with utilization > 80% and CIBIL < 600.\n",
            "- **EMI Recalibration**: Transition medium-risk customers to structured repayment options to avoid credit rating downgrades."
        ]
        for chunk in mock_chunks:
            yield f"data: {chunk}\n\n"
            await asyncio.sleep(0.2)
        yield "data: [DONE]\n\n"
        return

    try:
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=system_instruction
        )
        # Start response stream
        response = model.generate_content(query, stream=True)
        for chunk in response:
            if chunk.text:
                yield f"data: {chunk.text}\n\n"
                await asyncio.sleep(0.02)
        yield "data: [DONE]\n\n"
    except Exception as e:
        print(f"Gemini Regulatory Simulation streaming error: {e}")
        yield f"data: Simulation Error: {str(e)}\n\n"
        yield "data: [DONE]\n\n"
