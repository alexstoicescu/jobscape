// Focused XML reader for public Personio feeds. Uses no Node or browser DOM API.
// No DTDs, external entities, or custom entities; fail closed on malformed XML.
export type XmlNode={name:string;children:XmlNode[];parts:(string|XmlNode)[]};
const MAX_XML_CHARS=2*1024*1024,MAX_NODES=50000,MAX_DEPTH=32,MAX_TOKENS=100000;
const xmlCharacter=(code:number)=>code===9||code===10||code===13||code>=0x20&&code<=0xd7ff||code>=0xe000&&code<=0xfffd||code>=0x10000&&code<=0x10ffff;
function entities(text:string){
 return text.replace(/&([^;\s<&]*);|&/g,(token,name:string|undefined)=>{
  const named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
  if(name&&Object.hasOwn(named,name))return named[name];
  if(name&&/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(name)){
   const code=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));
   if(xmlCharacter(code))return String.fromCodePoint(code);
  }
  throw new Error(`Malformed XML entity: ${token.slice(0,60)}`);
 });
}
export function parseXml(source:string):XmlNode{
 if(source.length>MAX_XML_CHARS)throw new Error('Personio XML exceeds the 2 Mi-character parser limit.');
 const xml=source.replace(/^\uFEFF/,'');
 for(const char of xml)if(!xmlCharacter(char.codePointAt(0)!))throw new Error('Invalid XML character.');
 let index=0,nodes=0,tokens=0,root:XmlNode|undefined;const stack:XmlNode[]=[];
 const addText=(text:string)=>{if(stack.length)stack[stack.length-1].parts.push(text);else if(text.trim())throw new Error('Text outside the XML root.');};
 while(index<xml.length){
  if(++tokens>MAX_TOKENS)throw new Error('XML token limit exceeded.');
  if(xml[index]!=='<'){
   const next=xml.indexOf('<',index),end=next<0?xml.length:next;
   const text=xml.slice(index,end);if(text.includes(']]>'))throw new Error('Malformed XML character data.');
   addText(entities(text));index=end;continue;
  }
  if(xml.startsWith('<!--',index)){
   const end=xml.indexOf('-->',index+4);
   if(end<0||xml.slice(index+4,end).includes('--'))throw new Error('Malformed XML comment.');
   index=end+3;continue;
  }
  if(xml.startsWith('<![CDATA[',index)){
   const end=xml.indexOf(']]>',index+9);
   if(end<0||!stack.length)throw new Error('Malformed XML CDATA.');
   addText(xml.slice(index+9,end));index=end+3;continue;
  }
  if(xml.startsWith('<?',index)){
   const end=xml.indexOf('?>',index+2);
   if(index!==0||end<0||!/^<\?xml\s+version=["']1\.0["'](?:\s+encoding=["']UTF-8["'])?\s*\?>$/i.test(xml.slice(index,end+2)))throw new Error('Unsupported XML declaration or processing instruction.');
   index=end+2;continue;
  }
  if(xml.startsWith('<!',index))throw new Error('XML declarations/DTDs are not supported.');
  let end=index+1,quote='';
  for(;end<xml.length;end++){
   const char=xml[end];if(quote){if(char===quote)quote='';}else if(char==='"'||char==="'")quote=char;else if(char==='>')break;
   if(end-index>2048)throw new Error('XML tag length limit exceeded.');
  }
  if(end===xml.length||quote)throw new Error('Unterminated XML tag.');
  const tag=xml.slice(index+1,end);index=end+1;
  if(tag.startsWith('/')){
   const name=tag.slice(1).trim();if(!/^[A-Za-z_][\w.:-]*$/.test(name)||stack.pop()?.name!==name)throw new Error('Mismatched XML closing tag.');
   continue;
  }
  const selfClosing=tag.endsWith('/'),body=selfClosing?tag.slice(0,-1):tag;
  const match=/^([A-Za-z_][\w.:-]*)/.exec(body);if(!match)throw new Error('Malformed XML opening tag.');
  let attrs=body.slice(match[0].length);const seen=new Set<string>();
  while(attrs.trim()){
   const attr=/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(attrs);
   if(!attr||seen.has(attr[1]))throw new Error('Malformed or duplicate XML attribute.');
   entities(attr[2]??attr[3]);seen.add(attr[1]);attrs=attrs.slice(attr[0].length);
  }
  if(++nodes>MAX_NODES||stack.length>=MAX_DEPTH)throw new Error('XML node/depth limit exceeded.');
  const node:XmlNode={name:match[1],children:[],parts:[]};
  const parent=stack[stack.length-1];if(parent){parent.children.push(node);parent.parts.push(node);}else{if(root)throw new Error('Multiple XML roots.');root=node;}
  if(!selfClosing)stack.push(node);
 }
 if(stack.length||!root)throw new Error('Incomplete XML document.');
 return root;
}
export const children=(node:XmlNode,name:string)=>node.children.filter(child=>child.name===name);
export const nodeText=(node:XmlNode):string=>node.parts.map(part=>typeof part==='string'?part:nodeText(part)).join('');
export const field=(node:XmlNode,name:string)=>{const child=children(node,name)[0];return child?nodeText(child).trim():'';};
