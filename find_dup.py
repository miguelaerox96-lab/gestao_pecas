content = open('public/admin.html', encoding='utf-8').read()

# Find the last occurrence of the primary NEW closing sequence  
# The new bulk view ends with: </div>\n        </div>\n then the junk starts
# Find by line numbers - line 671 closes the new view, lines 672-732 are junk

# Simpler: find the FIRST </main> after the new section
# The new section ends around char position for line 671
# Find all occurrences of "</main>" 
import re
for m in re.finditer(r'</main>', content):
    print(f'</main> at pos {m.start()}, line ~{content[:m.start()].count(chr(10))+1}')

# Find view-header after line 671
for m in re.finditer(r'view-header', content):
    line = content[:m.start()].count(chr(10))+1
    print(f'view-header at line {line}')
