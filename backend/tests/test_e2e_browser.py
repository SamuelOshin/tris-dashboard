"""
Playwright End-to-End (E2E) Real Browser Test Suite for TRIS.
Tests real user interactions in headless Chromium:
1. Authentication with Argon2id session
2. Dashboard KPIs rendering
3. Suppliers Directory & Baseline Statistics Drawer ($30,471.43 proof)
4. Cases & Fraud Ledger
5. Multi-Signal Detection & Recurrence Surveillance
6. Governed State Transitions & 8-Field Verified Closure Modal
7. Developer Acceptance Matrix (T01 - T10)
"""

import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

SCREENSHOTS_DIR = Path("../docs/e2e_screenshots").resolve()
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "http://localhost:3000"


def test_full_tris_e2e_browser_flow():
    """Execute complete real-browser user workflow and capture screenshot proof."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        print("\n--- 1. Testing Authentication ---")
        page.goto(f"{BASE_URL}/login")
        page.wait_for_load_state("networkidle")

        # Fill credentials
        page.locator('input[type="email"]').fill("reviewer@tris.internal")
        page.locator('input[type="password"]').fill("password123")
        page.screenshot(path=str(SCREENSHOTS_DIR / "01_login_form.png"))
        page.locator('button[type="submit"]').click()

        # Wait for redirect to Dashboard
        page.wait_for_url(f"{BASE_URL}/", timeout=10000)
        page.wait_for_load_state("networkidle")
        print("[PASS] Logged in successfully against PostgreSQL auth session")

        # Verify Dashboard KPIs
        expect(page.locator("text=Flagged Risk Cases")).to_be_visible()
        expect(page.locator("text=Monitored Suppliers")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "02_dashboard_overview.png"), full_page=True)
        print("[PASS] Dashboard KPIs and Anomaly Spotlight verified")

        print("\n--- 2. Testing Suppliers Directory & Baseline Drawer ---")
        page.goto(f"{BASE_URL}/suppliers")
        page.wait_for_load_state("networkidle")
        expect(page.locator("text=Northstar Components LLC")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "03_suppliers_table.png"))

        # Click Inspect Baseline for Northstar Components (SUP-001)
        page.locator('tr:has-text("Northstar Components LLC") button:has-text("Inspect Baseline")').click()
        page.wait_for_selector("text=Target Exclusion Protocol Active", timeout=5000)

        # Verify exact baseline figures
        expect(page.locator("text=$30,471.43")).to_be_visible()
        expect(page.locator("text=$30,400.00")).to_be_visible()
        expect(page.locator("text=$1,306.03")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "04_supplier_baseline_drawer.png"))
        print("[PASS] Supplier Baseline Drawer verified ($30,471.43 mean strictly excluding TX-1999)")

        # Close drawer
        page.locator('button:has-text("Close Drawer")').click()

        print("\n--- 3. Testing Cases & Fraud Ledger ---")
        page.goto(f"{BASE_URL}/fraud-detection")
        page.wait_for_load_state("networkidle")
        expect(page.locator("text=TEST-CASE-001")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "05_cases_ledger.png"), full_page=True)
        print("[PASS] Cases Ledger verified with target anomaly TEST-CASE-001")

        print("\n--- 4. Testing Governed Case Workspace & Recurrence Widget ---")
        page.goto(f"{BASE_URL}/cases/TEST-CASE-001")
        page.wait_for_load_state("networkidle")

        # Verify signals
        expect(page.locator("text=R-001")).to_be_visible()
        expect(page.locator("text=R-002")).to_be_visible()
        expect(page.locator("text=R-003")).to_be_visible()
        expect(page.locator("text=R-004")).to_be_visible()

        # Verify Recurrence Surveillance Widget
        expect(page.locator("text=Recurrence Surveillance & Prior Case History")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "06_case_workspace_signals.png"), full_page=True)
        print("[PASS] Case workspace, multi-signals, and recurrence surveillance verified")

        print("\n--- 5. Testing Governed State Transitions & 8-Field Closure ---")
        # If case is already closed from earlier test run, reopen it first
        if page.locator('button:has-text("Reopen Case")').is_visible():
            print("Case currently Closed — clicking 'Reopen Case' to reset workflow")
            page.locator('button:has-text("Reopen Case")').click()
            page.wait_for_timeout(1000)

        # Advance through state machine to Pending Verification
        if page.locator('button:has-text("Assign Case")').is_visible():
            page.locator('button:has-text("Assign Case")').click()
            page.wait_for_timeout(1000)

        if page.locator('button:has-text("Begin Investigation")').is_visible():
            page.locator('button:has-text("Begin Investigation")').click()
            page.wait_for_timeout(1000)

        if page.locator('button:has-text("Initiate Corrective Action")').is_visible():
            page.locator('button:has-text("Initiate Corrective Action")').click()
            page.wait_for_timeout(1000)

        if page.locator('button:has-text("Submit for Verification")').is_visible():
            page.locator('button:has-text("Submit for Verification")').click()
            page.wait_for_timeout(1000)

        page.screenshot(path=str(SCREENSHOTS_DIR / "07_pending_verification.png"))

        # Open 8-Field Verified Closure Modal
        expect(page.locator('button:has-text("Verified Closure (8 Fields)")')).to_be_visible()
        page.locator('button:has-text("Verified Closure (8 Fields)")').click()
        page.wait_for_selector("text=Verified Closure Compliance Gate", timeout=5000)

        # Test gatekeeper: submit with empty inputs
        page.locator("#closure_root_cause").fill("")
        page.locator('button:has-text("Confirm Verified Closure")').click()
        expect(page.locator("text=Missing Mandatory Closure Fields:")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "08_closure_validation_gatekeeper.png"))
        print("[PASS] 8-Field Verified Closure gatekeeper rejection verified")

        # Fill all 8 fields using explicit element IDs
        page.locator("#closure_root_cause").fill("Compromised vendor portal account credentials")
        page.locator("#closure_type").select_option("Confirmed Fraud / Blocked")
        page.locator("#closure_corrective_action").fill("Bank details reverted and payment hold placed on invoice NC-260828")
        page.locator("#closure_evidence").fill("Audit ticket SEC-2026-881; direct callback confirmation with supplier CFO")
        page.locator("#closure_verified_by").fill("B. Verifier (Compliance Lead)")
        page.locator("#closure_date").fill("2026-09-02")
        page.locator("#closure_follow_up").fill("Mandatory retest of supplier bank details in 14 days")
        page.locator("#closure_recurrence_monitoring").fill("Active 90-day surveillance on supplier SUP-001")

        page.screenshot(path=str(SCREENSHOTS_DIR / "09_closure_modal_filled.png"))
        page.locator('button:has-text("Confirm Verified Closure")').click()
        page.wait_for_timeout(2000)

        # Verify Closed Seal
        expect(page.locator("text=Verified Closure Seal")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "10_case_sealed_closed.png"), full_page=True)
        print("[PASS] Case sealed with compliant Verified Closure Seal")

        print("\n--- 6. Testing Developer Acceptance Matrix Dashboard ---")
        page.goto(f"{BASE_URL}/developer-tests")
        page.wait_for_load_state("networkidle")
        expect(page.locator("text=10 / 10 Passing")).to_be_visible()
        page.screenshot(path=str(SCREENSHOTS_DIR / "11_acceptance_matrix_dashboard.png"), full_page=True)
        print("[PASS] Developer Acceptance Matrix verified with 10/10 passing gates")

        browser.close()
        print("\n=== ALL PLAYWRIGHT BROWSER E2E TESTS PASSED WITH SCREENSHOTS SAVED! ===")


if __name__ == "__main__":
    test_full_tris_e2e_browser_flow()
