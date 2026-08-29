import re, xml.etree.ElementTree as ET, sys
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W=NS['w']
tree=ET.parse(sys.argv[1]); root=tree.getroot()
body=root.find(f'{{{W}}}body')

def para_text(p):
    parts=[]
    for node in p.iter():
        tag=node.tag.split('}')[-1]
        if tag=='t': parts.append(node.text or '')
        elif tag=='tab': parts.append('\t')
        elif tag=='br': parts.append('\n')
    return ''.join(parts)

def style_of(p):
    pPr=p.find(f'{{{W}}}pPr')
    if pPr is None: return None,None
    st=pPr.find(f'{{{W}}}pStyle')
    numPr=pPr.find(f'{{{W}}}numPr')
    ilvl=None
    if numPr is not None:
        il=numPr.find(f'{{{W}}}ilvl')
        ilvl=int(il.get(f'{{{W}}}val')) if il is not None else 0
    return (st.get(f'{{{W}}}val') if st is not None else None), ilvl

out=[]
def walk(el, depth=0):
    for child in el:
        tag=child.tag.split('}')[-1]
        if tag=='p':
            txt=para_text(child)
            st,ilvl=style_of(child)
            prefix=''
            if st:
                m=re.match(r'(?:Heading|heading)(\d)', st)
                if m: prefix='#'*int(m.group(1))+' '
                elif st.lower().startswith('title'): prefix='# '
            if ilvl is not None and not prefix:
                prefix='  '*ilvl+'- '
            if txt.strip() or prefix.strip():
                out.append(prefix+txt)
            else:
                out.append('')
        elif tag=='tbl':
            out.append('')
            for tr in child.findall(f'{{{W}}}tr'):
                cells=[]
                for tc in tr.findall(f'{{{W}}}tc'):
                    ct=' '.join(para_text(p).strip() for p in tc.findall(f'{{{W}}}p'))
                    cells.append(ct.strip())
                out.append('| '+' | '.join(cells)+' |')
            out.append('')
        elif tag in ('sdt',):
            c=child.find(f'{{{W}}}sdtContent')
            if c is not None: walk(c, depth)
walk(body)
text='\n'.join(out)
text=re.sub(r'\n{3,}','\n\n',text)
print(text)
