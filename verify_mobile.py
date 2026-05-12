import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Set to mobile viewport
        page = browser.new_page(viewport={"width": 375, "height": 667})

        # Navigate to index
        page.goto('http://localhost:8081/index.html')

        # Take screenshot of the mobile UI
        page.screenshot(path='mobile_ui.png', full_page=True)
        print("Saved mobile_ui.png")

        browser.close()

if __name__ == '__main__':
    run()
