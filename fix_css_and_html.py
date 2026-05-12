with open('style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# Change to text-muted-light for dark backgrounds where needed
css_content = css_content.replace('color: var(--text-muted);', 'color: var(--text-muted-light);')

# But we know form-group label and quest-card p are on light backgrounds (.witch-paper is light)
# .witch-paper has background-color: var(--bg-card); which is #f4ecd8 (Old parchment paper)
# .quest-card usually has witch-frame, let's see its background

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css_content)
