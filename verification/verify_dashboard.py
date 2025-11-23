from playwright.sync_api import sync_playwright

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to demo page
        page.goto("http://localhost:3000")

        # Wait for the dashboard to load (look for the "System Health" header)
        page.wait_for_selector("h2:has-text('System Health')")

        # Wait for the status to become 'Live' (green) which indicates data fetch success
        page.wait_for_selector("#shm-status:has-text('Live')")

        # Wait a moment for charts to render
        page.wait_for_timeout(2000)

        # Take screenshot
        page.screenshot(path="verification/dashboard.png")

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
