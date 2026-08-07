with open(r'C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

head = ''.join(lines[:3838])

with open(r'C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\tail_import_fix.js', 'r', encoding='utf-8') as f:
    tail = f.read()

with open(r'C:\Users\LOGISCCS03\.gemini\antigravity\scratch\taskmaster\app.js', 'w', encoding='utf-8') as f:
    f.write(head + '\n' + tail)

print("SUCCESSFULLY APPLIED FIX TO APP.JS")
