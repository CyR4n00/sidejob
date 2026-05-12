with open('style.css', 'r', encoding='utf-8') as f:
    css_content = f.read()

# We want .text-muted to refer to var(--text-muted)
css_content = css_content.replace('.text-muted { color: var(--text-muted-light); }', '.text-muted { color: var(--text-muted); }')

# For quest-card p, it is on the light parchment background
css_content = css_content.replace('.quest-card p { margin-bottom: 1.5rem; color: var(--text-muted-light); }', '.quest-card p { margin-bottom: 1.5rem; color: var(--text-muted); }')

# For form-group label, it is also on the light parchment background (.witch-frame)
css_content = css_content.replace('color: var(--text-muted-light);\n}\n\ninput', 'color: var(--text-muted);\n}\n\ninput')

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(css_content)
