window.CSharpImporter = (() => {
 const clean = s => String(s || "").trim();
 function matchingBrace(source, open) {
  let depth=0, quote="", verbatim=false, line=false, block=false;
  for(let i=open;i<source.length;i++){
   const c=source[i],n=source[i+1];
   if(line){if(c==="\n")line=false;continue}
   if(block){if(c==="*"&&n==="/"){block=false;i++}continue}
   if(quote){if(c==="\\"&&!verbatim){i++;continue}if(c===quote){if(verbatim&&n===quote){i++;continue}quote=""}continue}
   if(c==="/"&&n==="/"){line=true;i++;continue}
   if(c==="/"&&n==="*"){block=true;i++;continue}
   if(c==="@"&&n==='"'){quote='"';verbatim=true;i++;continue}
   if(c==='"'||c==="'"){quote=c;verbatim=false;continue}
   if(c==="{")depth++;
   else if(c==="}"&&--depth===0)return i;
  }
  return source.length-1;
 }
 function stripComments(source){return source.replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1")}
 function splitStatements(body){
  const out=[];let start=0,round=0,square=0,brace=0,quote="",verbatim=false;
  for(let i=0;i<body.length;i++){
   const c=body[i],n=body[i+1];
   if(quote){if(c==="\\"&&!verbatim){i++;continue}if(c===quote){if(verbatim&&n===quote){i++;continue}quote=""}continue}
   if(c==="@"&&n==='"'){quote='"';verbatim=true;i++;continue}
   if(c==='"'||c==="'"){quote=c;verbatim=false;continue}
   if(c==="(")round++;else if(c===")")round--;
   else if(c==="[")square++;else if(c==="]")square--;
   else if(c==="{")brace++;else if(c==="}")brace--;
   if(c===";"&&round===0&&square===0&&brace===0){const part=clean(body.slice(start,i+1));if(part)out.push(part);start=i+1}
   else if(c==="}"&&round===0&&square===0&&brace===0){const part=clean(body.slice(start,i+1));if(part)out.push(part);start=i+1}
  }
  const tail=clean(body.slice(start));if(tail)out.push(tail);
  return out;
 }
 function parse(source){
  source=stripComments(String(source||"")).replace(/\r/g,"");
  const classMatch=source.match(/\bclass\s+([A-Za-z_]\w*)[^{}]*\{/);
  const className=classMatch?.[1]||"ImportedScript";
  const classOpen=classMatch?source.indexOf("{",classMatch.index):0;
  const classClose=matchingBrace(source,classOpen);
  const classBody=source.slice(classOpen+1,classClose);
  const methods=[],covered=[];
  const methodRegex=/\b(?:public|private|protected|internal|static|virtual|override|async|new|sealed|partial|extern|unsafe|\s)+[\w<>,\[\]?.]+\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  let match;
  while((match=methodRegex.exec(classBody))){
   const open=classBody.indexOf("{",match.index+match[0].lastIndexOf(")"));
   if(open<0)continue;
   const close=matchingBrace(classBody,open);
   methods.push({name:match[1],body:classBody.slice(open+1,close),statements:splitStatements(classBody.slice(open+1,close))});
   covered.push([match.index,close+1]);
   methodRegex.lastIndex=Math.max(methodRegex.lastIndex,close+1);
  }
  let fields=classBody;
  for(let i=covered.length-1;i>=0;i--)fields=fields.slice(0,covered[i][0])+fields.slice(covered[i][1]);
  const variables=[],fieldSpans=[];
  const fieldRegex=/\b(?:(public|private|protected|internal)\s+)?(?:(static|readonly|const|SerializeField)\s+)*([A-Za-z_]\w*(?:<[^;=]+>)?(?:\[\])?)\s+([A-Za-z_]\w*)\s*(?:=\s*([^;]+))?;/g;
  while((match=fieldRegex.exec(fields))){
   const type=match[3],name=match[4],initial=clean(match[5]||"");
   if(["using","return","namespace"].includes(type))continue;
   variables.push({name,type,initial,access:match[1]==="public"?"public-inspector":match[1]==="private"||/SerializeField/i.test(match[0])?"private-inspector":"private"});
   fieldSpans.push([match.index,fieldRegex.lastIndex]);
  }
  for(let i=fieldSpans.length-1;i>=0;i--)fields=fields.slice(0,fieldSpans[i][0])+fields.slice(fieldSpans[i][1]);
  const classExtras=clean(fields.replace(/^\s*using\b[^;]*;/gm,"").replace(/^\s*namespace\b[^;]*;/gm,"").replace(/^\s*\[[^\]]+\]\s*/gm,""));
  return {className,variables,methods,classExtras};
 }
 return {parse,splitStatements};
})();