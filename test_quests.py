from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto('http://localhost:8081/index.html')

        page.evaluate('''() => {
            document.getElementById('auth-screen').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
            document.getElementById('quest-board').classList.add('active');
        }''')

        page.screenshot(path='quest_visibility.png', full_page=True)
        print("Saved quest_visibility.png")

        page.evaluate('''() => {
            document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));
            document.getElementById('settings').classList.add('active');
        }''')
        page.screenshot(path='settings_visibility.png', full_page=True)
        print("Saved settings_visibility.png")

        browser.close()

if __name__ == '__main__':
    run()
