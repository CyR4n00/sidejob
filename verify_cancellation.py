import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})

        # Navigate to index
        page.goto('http://localhost:8081/index.html')

        page.evaluate('''() => {
            // First, make settings visible
            document.querySelectorAll('.content-section').forEach(el => {
                el.classList.remove('active');
                el.style.display = 'none';
            });
            let settings = document.getElementById('settings');
            settings.classList.add('active');
            settings.style.display = 'block';

            // Bypass the need to interact with the UI elements directly
            // by injecting the userState since we just want to verify the pro UI
            localStorage.setItem('aiQuestState', JSON.stringify({
                email: 'test@example.com',
                gemini_api_key: '',
                is_pro: true
            }));
        }''')

        # Reload to pick up the local storage state
        page.reload()

        page.evaluate('''() => {
            document.querySelectorAll('.content-section').forEach(el => {
                el.classList.remove('active');
                el.style.display = 'none';
            });
            let settings = document.getElementById('settings');
            settings.classList.add('active');
            settings.style.display = 'block';
        }''')

        time.sleep(1)

        # Click the cancel button
        page.on("dialog", lambda dialog: dialog.accept())
        page.evaluate('''() => {
            document.getElementById('btn-cancel-pro').click();
        }''')
        time.sleep(1)

        # Take screenshot of the canceled state
        page.screenshot(path='canceled_ui_fixed.png', full_page=True)
        print("Saved canceled_ui_fixed.png")

        browser.close()

if __name__ == '__main__':
    run()
