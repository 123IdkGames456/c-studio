(() => {
const $ = id => document.getElementById(id);
const defs = BlueprintBlocks.defs;
const CUSTOM_BLOCKS_KEY="ikirumi-unity-custom-blocks-v1";
const EXPLORE_DEFAULT_ENDPOINT="https://script.google.com/macros/s/AKfycbyums-BiInck2eEO7ZxWgDclx5NXufvuIWBXQ8DnYbuRh8ClUzqLf1S6yB3qB1AQpyt/exec";
const EXPLORE_ENDPOINT_KEY="cstudio-explore-endpoint-v1";
let customBlocks=(()=>{try{const x=JSON.parse(localStorage.getItem(CUSTOM_BLOCKS_KEY)||"[]");return Array.isArray(x)?x:[]}catch{return []}})();
let customEditingId=null,customParentState=null,customEditorStack=[],lastCustomNodeClick={id:null,time:0};
let nodes = [], links = [], variables = [], nextNode = 1, nextVariable = 1;
let selectedNode = null, pendingPin = null, activeCategory = "All", codeVisible = true, activeView = "graph";
function saveCustomBlocks(){try{localStorage.setItem(CUSTOM_BLOCKS_KEY,JSON.stringify(customBlocks))}catch(e){status("Custom block save failed: browser storage is full")}}
function mergeCustomBlocks(incoming,preferExisting=false){if(!Array.isArray(incoming))return;const merged=new Map(customBlocks.map(b=>[String(b.id),b]));incoming.forEach(b=>{if(b&&b.id&&(!preferExisting||!merged.has(String(b.id))))merged.set(String(b.id),b)});customBlocks=[...merged.values()];saveCustomBlocks();syncCustomDefs()}
function customPortList(boundaryType,def=customBlocks.find(x=>x.id===customEditingId)){return def?.nodes?.find(n=>n.type===boundaryType)?.values?.ports||[]}
function syncCustomDefs(){
 for(let i=defs.length-1;i>=0;i--)if(String(defs[i].id).startsWith("customblock_"))defs.splice(i,1);
 customBlocks.forEach(block=>{
  const inputs=block.nodes?.find(n=>n.type==="custominput")?.values?.ports||[];
  const outputs=block.nodes?.find(n=>n.type==="customoutput")?.values?.ports||[];
  defs.push({id:"customblock_"+block.id,name:block.name,category:"Custom Nodes",color:block.color||"#d09aff",kind:"flow",desc:block.description||"Reusable custom block. Double-click to edit; all instances share this definition.",aliases:[block.name.toLowerCase(),"custom "+block.name.toLowerCase()],flowIn:["Exec"],flowOut:["Then"],dataIn:inputs.map(p=>({id:p.id,label:p.name,type:p.type,optional:true,default:p.default})),dataOut:outputs.map(p=>({id:p.id,label:p.name,type:p.type}))});
 });
}
syncCustomDefs();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const getDef = id => defs.find(d => d.id === id);
const getNode = id => nodes.find(n => n.id === id);
const getVar = id => variables.find(v => v.id === id);
function connectedComponentType(n){
 if(!n||!["getcomponentvalue","setcomponent"].includes(n.type))return null;
 const link=links.find(l=>l.kind==="data"&&l.to===n.id&&l.toPin==="component");
 if(!link){const v=getVar(n.values?.componentVariable);return v&&BlueprintTypes.unity.includes(v.type)?v.type:null;}
 const source=getNode(link.from);
 if(!source)return null;
 if(source.type==="getcomponent")return source.values?.componentType||"Rigidbody";
 if(source.type==="getvar"){
  const v=getVar(source.values?.variable);
  return v&&BlueprintTypes.unity.includes(v.type)?v.type:null;
 }
 return null;
}
function nodeInputs(n){
 if(n?.type==="custominput")return [];
 if(n?.type==="customoutput")return (n.values?.ports||[]).map(p=>({id:p.id,label:p.name,type:p.type}));
 if(n?.type==="foreach"){const d=getDef(n.type),type=n.values?.elementType||"GameObject";return (d?.dataIn||[]).map(p=>({...p,type:p.id==="list"?"List<"+type+">":p.type}));}
 if(["listelement","listclosest","listfarthest"].includes(n?.type)){const d=getDef(n.type),type=n.values?.elementType||"GameObject";return (d?.dataIn||[]).map(p=>p.id==="list"?{...p,type:"List<"+type+">"}:p.id==="index"?{...p,type:"int"}:{...p,type});}
 const d=getDef(n?.type);
 if(n?.type==="literal")return [];
 if(["raycast","spherecast","overlapsphere"].includes(n?.type)){const mode=n.values?.tagMode||"none",debugLinked=links.some(l=>l.kind==="data"&&l.to===n.id&&l.toPin==="showDebug"),debugEnabled=n.values?.showDebug===true||n.values?.showDebug==="true",showColors=debugLinked||debugEnabled;return (d?.dataIn||[]).filter(p=>(n.type!=="raycast"||!["tag","tags"].includes(p.id)||(p.id==="tag"&&mode==="tag")||(p.id==="tags"&&mode==="tags"))||(["hitColor","missColor"].includes(p.id)&&showColors));}
 if(n?.type==="if")return (n.values?.branchMode||"Exec")==="Exec"?[{id:"condition",label:"Condition",type:"bool"}]:[{id:"condition",label:"Condition",type:"bool"},{id:"trueValue",label:"True",type:n.values.branchMode},{id:"falseValue",label:"False",type:n.values.branchMode}];
 if(n?.type==="transform"){
  const operation=n.values?.operation||"setPosition";
  const base=(d?.dataIn||[]).filter(p=>p.id==="target");
  if(operation==="setRotation")return [...base,...(d?.dataIn||[]).filter(p=>p.id==="quaternion")];
  if(["setPosition","translate","rotate","setScale"].includes(operation))return [...base,...(d?.dataIn||[]).filter(p=>p.id==="vector")];
  return base;
 }
 if(n?.type==="vector"){
  const type=n.values?.vectorType||"Vector3";
  return (d?.dataIn||[]).filter(p=>p.id==="x"||p.id==="y"||(p.id==="z"&&!["Vector2"].includes(type))||(p.id==="w"&&["Vector4","Quaternion","Color","Color32"].includes(type)));
 }
 if(n?.type!=="setcomponent")return d?.dataIn||[];
 const ct=connectedComponentType(n);
 if(!ct)return d?.dataIn||[];
 const allowed=componentProperties[ct]||[];
 const props=allowed.filter(([id])=>n.values?.["use_"+id]==="true").map(([id,label])=>({id,label,type:componentPropertyType(ct,id)}));
 return [...(d?.dataIn||[]),...props];
}
function nodeOutputs(n){
 const d=getDef(n?.type);
 if(n?.type==="custominput"||n?.type==="customoutput")return (n.values?.ports||[]).map(p=>({id:p.id,label:p.name,type:p.type}));
 if(n?.type==="foreach"&&(n.values?.mode||"Loop")!=="LoopWithOutput")return [];
 if(n?.type!=="getcomponentvalue")return d?.dataOut||[];
 const ct=connectedComponentType(n);
 if(!ct)return [];
 return (componentProperties[ct]||[]).map(([id,label])=>({id,label,type:componentPropertyType(ct,id)}));
}

function componentPropertyType(component,property){
 const map={
  Joint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",massScale:"float",connectedMassScale:"float"},
  FixedJoint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",massScale:"float",connectedMassScale:"float"},
  SpringJoint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",spring:"float",damper:"float",minDistance:"float",maxDistance:"float",tolerance:"float",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool"},
  HingeJoint:{limits:"JointLimits",useLimits:"bool",motor:"JointMotor",spring:"JointSpring",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",connectedBody:"Rigidbody"},
  HingeJoint2D:{limits:"JointAngleLimits2D",useLimits:"bool",useMotor:"bool",useSpring:"bool",motor:"JointMotor2D",breakForce:"float",breakTorque:"float",enableCollision:"bool",connectedBody:"Rigidbody2D"},
  CharacterJoint:{connectedBody:"Rigidbody",swingAxis:"Vector3",lowTwistLimit:"SoftJointLimit",highTwistLimit:"SoftJointLimit",swing1Limit:"SoftJointLimit",swing2Limit:"SoftJointLimit",twistLimitSpring:"SoftJointLimitSpring",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool"},
  ConfigurableJoint:{connectedBody:"Rigidbody",xMotion:"ConfigurableJointMotion",yMotion:"ConfigurableJointMotion",zMotion:"ConfigurableJointMotion",angularXMotion:"ConfigurableJointMotion",angularYMotion:"ConfigurableJointMotion",angularZMotion:"ConfigurableJointMotion",targetPosition:"Vector3",targetVelocity:"Vector3",targetRotation:"Quaternion",targetAngularVelocity:"Vector3",linearLimit:"SoftJointLimit",lowAngularXLimit:"SoftJointLimit",highAngularXLimit:"SoftJointLimit",angularYLimit:"SoftJointLimit",angularZLimit:"SoftJointLimit",configuredInWorldSpace:"bool",swapBodies:"bool",projectionDistance:"float",projectionAngle:"float"},
  Joint2D:{connectedBody:"Rigidbody2D",anchor:"Vector2",connectedAnchor:"Vector2",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool"},
  Rigidbody:{mass:"float",drag:"float",angularDrag:"float",useGravity:"bool",isKinematic:"bool",detectCollisions:"bool",constraints:"RigidbodyConstraints"},
  Rigidbody2D:{mass:"float",gravityScale:"float",linearDamping:"float",angularDamping:"float",simulated:"bool",bodyType:"RigidbodyType2D",constraints:"RigidbodyConstraints2D"},
  Transform:{position:"Vector3",localPosition:"Vector3",rotation:"Quaternion",localRotation:"Quaternion",localScale:"Vector3"},
  Collider:{enabled:"bool",isTrigger:"bool"},Collider2D:{enabled:"bool",isTrigger:"bool"},
  BoxCollider:{enabled:"bool",isTrigger:"bool",center:"Vector3",size:"Vector3"},
  SphereCollider:{enabled:"bool",isTrigger:"bool",center:"Vector3",radius:"float"},
  CapsuleCollider:{enabled:"bool",isTrigger:"bool",center:"Vector3",radius:"float",height:"float",direction:"int"},
  MeshCollider:{enabled:"bool",isTrigger:"bool",sharedMesh:"Mesh",convex:"bool"},
  BoxCollider2D:{enabled:"bool",isTrigger:"bool",offset:"Vector2",size:"Vector2"},
  CircleCollider2D:{enabled:"bool",isTrigger:"bool",offset:"Vector2",radius:"float"},
  CapsuleCollider2D:{enabled:"bool",isTrigger:"bool",offset:"Vector2",size:"Vector2",direction:"CapsuleDirection2D"},
  CharacterController:{enabled:"bool",height:"float",radius:"float",center:"Vector3",slopeLimit:"float",stepOffset:"float",skinWidth:"float",minMoveDistance:"float",detectCollisions:"bool",enableOverlapRecovery:"bool"},
  ConstantForce:{force:"Vector3",relativeForce:"Vector3",torque:"Vector3",relativeTorque:"Vector3"},
  Animator:{enabled:"bool",applyRootMotion:"bool",speed:"float",updateMode:"AnimatorUpdateMode",cullingMode:"AnimatorCullingMode"},
  AudioSource:{volume:"float",pitch:"float",loop:"bool",playOnAwake:"bool",mute:"bool"},
  Camera:{fieldOfView:"float",orthographic:"bool",orthographicSize:"float",nearClipPlane:"float",farClipPlane:"float"},
  Light:{intensity:"float",range:"float",color:"Color",enabled:"bool"},
  NavMeshAgent:{speed:"float",angularSpeed:"float",acceleration:"float",stoppingDistance:"float",isStopped:"bool"},
  WheelCollider:{motorTorque:"float",brakeTorque:"float",steerAngle:"float"},
  SpriteRenderer:{enabled:"bool",color:"Color",flipX:"bool",flipY:"bool",sortingOrder:"int",sprite:"Sprite"},
  MeshRenderer:{enabled:"bool",receiveShadows:"bool",shadowCastingMode:"ShadowCastingMode",sortingOrder:"int"},
  ParticleSystem:{loop:"bool",playOnAwake:"bool",simulationSpeed:"float"}
 };
 return map[component]?.[property]||"object";
}
function actualOutputType(n,outputPin="value"){
 if(n?.type==="custominput"||n?.type==="customoutput")return (n.values?.ports||[]).find(p=>p.id===outputPin)?.type||"dynamic";
 if(String(n?.type||"").startsWith("customblock_"))return getDef(n.type)?.dataOut?.find(p=>p.id===outputPin)?.type||"dynamic";
  if(n?.type==="foreach")return n.values?.elementType||"GameObject";
 if(["listelement","listclosest","listfarthest"].includes(n?.type))return n.values?.elementType||"GameObject";
 if(n?.type==="getfirsttag")return "GameObject";
 if(n?.type==="getalltag")return "List<GameObject>";
 if(n?.type==="if"){
  const mode=n.values?.branchMode||"Exec";
  if(mode==="Exec")return "none";
  if(mode!=="dynamic")return mode;
  const yes=links.find(l=>l.kind==="data"&&l.to===n.id&&l.toPin==="trueValue");
  const no=links.find(l=>l.kind==="data"&&l.to===n.id&&l.toPin==="falseValue");
  return (yes&&actualOutputType(getNode(yes.from)))||(no&&actualOutputType(getNode(no.from)))||"dynamic";
 }
 if(n?.type==="vectorsplit3"||n?.type==="vectorsplit2"||n?.type==="quaternionsplit")return "float";
 if(!n)return "dynamic";
 const d=getDef(n.type);
 if(n.type==="literal")return n.values.type==="null"?"null":(n.values.type||"int");
 if(n.type==="getvar")return getVar(n.values.variable)?.type||"dynamic";
 if(n.type==="getcomponent")return n.values.componentType||"Rigidbody";
 if(n.type==="getcomponentvalue")return componentPropertyType(n.values.componentType||"Rigidbody",n.values.property||"mass");
 if(n.type==="literal"&&["Vector2","Vector3","Vector4","Quaternion","Color","Color32"].includes(n.values.type))return n.values.type;
 if(n.type==="math")return n.values.outputType||"float";
 if(n.type==="vectorsplit3"||n.type==="vectorsplit2"||n.type==="quaternionsplit")return "dynamic";
 if(n.type==="vectorcombine3")return "Vector3";
 if(n.type==="vectorcombine2")return "Vector2";
 if(n.type==="fromto")return n.values.toType||"string";
 if(n.type==="vector")return n.values.vectorType||"Vector3";
 if(n.type==="transform"){
  const op=n.values.operation||"setPosition";
  return op==="getPosition"||op==="getScale"?"Vector3":op==="getRotation"?"Quaternion":"none";
 }
 if(n.type==="gameobject")return (n.values.operation||"setActive")==="instantiate"?"GameObject":"none";
 return d?.valueOut||"dynamic";
}
function expectedInputType(n,p){
 if(n?.type==="foreach"){const type=n.values?.elementType||"GameObject";if(p.id==="list")return "List<"+type+">";if(p.id==="index")return "int";}
 if(["listelement","listclosest","listfarthest"].includes(n.type)){const type=n.values?.elementType||"GameObject";if(p.id==="list")return "List<"+type+">";if(p.id==="index")return "int";if(p.id==="reference")return n.values?.referenceType||"GameObject";}
 if(!n||!p)return "dynamic";
 if(n.type==="if"&&["trueValue","falseValue"].includes(p.id))return n.values?.branchMode||"dynamic";
 if((n.type==="vectorsplit3"||n.type==="vectorsplit2")&&p.id==="vector")return n.type==="vectorsplit3"?"Vector3":"Vector2";
  if(n.type==="quaternionsplit"&&p.id==="quaternion")return "Quaternion";
 if(n.type==="fromto"&&p.id==="value")return n.values.fromType||"float";
 if(n.type==="math"&&(p.id==="a"||p.id==="b"))return n.values.outputType||"float";
 if((n.type==="distance"||n.type==="distance2d")&&(p.id==="a"||p.id==="b"))return n.values[p.id+"Type"]==="object"?"object":(n.type==="distance2d"?"Vector2":"Vector3");
 if(n.type==="compare"&&(p.id==="a"||p.id==="b"))return n.values.operandType||"float";
 if(n.type==="setvar"&&p.id==="value")return getVar(n.values.variable)?.type||"dynamic";
 if(n.type==="setcomponent"){
  if(p.id==="component")return "Component";
  if(p.id==="minimumValue"||p.id==="maximumValue")return "float";
  if(p.id==="propertyValueInput")return componentPropertyType(n.values.componentType||"HingeJoint",n.values.property||"limits");
 }
 if(n.type==="transform"&&p.id==="vector")return "Vector3";
 return p.type||"dynamic";
}
function displayInputType(n,p){
 if(!n||!p)return "any";
 const connection=links.find(l=>l.kind==="data"&&l.to===n.id&&l.toPin===p.id);
 if(connection){
  const source=getNode(connection.from);
  if(source)return actualOutputType(source,connection.fromPin);
 }
 const expected=expectedInputType(n,p);
 return expected==="dynamic"?"any":expected;
}
function typesCompatible(from,to){
 if(from==="none")return false;
 if(/^List<.+>$/.test(from)&&/^List<.+>$/.test(to))return from===to;
 if(!from||!to||to==="dynamic"||to==="any")return true;
 if(from==="dynamic"||from==="any")return to==="dynamic"||to==="any";
 if((from==="object"||from==="UnityEngine.Object")&&(to==="UnityEngine.Object"||BlueprintTypes.unity.includes(to)&&!BlueprintTypes.isValue(to)))return true;if(to==="UnityEngine.Object"&&BlueprintTypes.unity.includes(from)&&!BlueprintTypes.isValue(from))return true;if(to==="Component"&&BlueprintTypes.unity.includes(from)&&!BlueprintTypes.isValue(from))return true;
 const numeric=["byte","sbyte","short","ushort","int","uint","long","ulong","float","double","decimal","number"];
 if(numeric.includes(from)&&numeric.includes(to))return true;
 if(from==="null")return to==="string"||to==="object"||!BlueprintTypes.isValue(to);
 return BlueprintTypes.compatible(from,to);
}
function inputActive(n,p){
 if(!n||!p)return false;
 if((n.type==="vector"||n.type==="literal")&&p.id==="z"&&(n.values.vectorType||n.values.type)==="Vector2")return false;
 if((n.type==="vector"||n.type==="literal")&&p.id==="w"&&["Vector2","Vector3"].includes(n.values.vectorType||n.values.type))return false;
 if(n.type==="transform"&&p.id==="vector"&&["getPosition","getRotation","getScale"].includes(n.values.operation))return false;
 if(n.type==="setcomponent"){
  if(p.id!=="component"&&p.id!=="propertyValueInput"&&p.id!=="minimumValue"&&p.id!=="maximumValue"&&(componentProperties[connectedComponentType(n)]||[]).some(([id])=>id===p.id))return true;
  if(p.id==="propertyValueInput"&&n.values.enabledProperty!=="true")return false;
  const prop=n.values.property||"mass";
  const bools=["useLimits","enableCollision","enablePreprocessing","useGravity","isKinematic","detectCollisions","simulated","isTrigger","enabled","loop","playOnAwake","mute","orthographic","isStopped"];
  
  if(p.id==="minimumValue"&&(prop!=="limits"||n.values.setMinimum!=="true"))return false;
  if(p.id==="maximumValue"&&(prop!=="limits"||n.values.setMaximum!=="true"))return false;
  if(p.id==="propertyValueInput"&&(prop==="limits"||bools.includes(prop)))return false;
 }
 return true;
}
function removeIncompatibleLinksForOutput(nodeId){
 const n=getNode(nodeId);
 links=links.filter(l=>{
  if(l.kind!=="data"||l.from!==nodeId)return true;
  const target=getNode(l.to),input=nodeInputs(target).find(p=>p.id===l.toPin);
  let fromType=actualOutputType(n,l.fromPin);
  if(n?.type==="getcomponentvalue")fromType=nodeOutputs(n).find(p=>p.id===l.fromPin)?.type||"none";
  return !!input&&inputActive(target,input)&&typesCompatible(fromType,expectedInputType(target,input));
 });
}
function removeIncompatibleLinksForInput(nodeId){
 const n=getNode(nodeId),td=getDef(n?.type);
 links=links.filter(l=>{
  if(l.kind!=="data"||l.to!==nodeId)return true;
  const source=getNode(l.from),input=nodeInputs(n).find(p=>p.id===l.toPin);
  return !!input&&inputActive(n,input)&&typesCompatible(actualOutputType(source,l.fromPin),expectedInputType(n,input));
 });
}
const categoryOrder = ["Events","Flow","Variables","Values","Math","Logic","Unity","Input","Physics","Time","Lists","Functions","Debug","Device","Utility"];
const categoryRank = category => { const i=categoryOrder.indexOf(category); return i<0?999:i; };
const allCategories = ["All", ...BlueprintBlocks.categories.slice().sort((a,b)=>categoryRank(a)-categoryRank(b)||a.localeCompare(b))];
function status(s){$("graphStatus").textContent=" · "+s}
function defaultNodePosition(){
 const workspace=$("workspace"),canvas=$("canvas"),wr=workspace.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
 const centerX=wr.left+workspace.clientWidth/2,centerY=wr.top+workspace.clientHeight/2;
 return {x:Math.max(0,Math.min(26900,centerX-cr.left+workspace.scrollLeft-125)),y:Math.max(0,Math.min(26900,centerY-cr.top+workspace.scrollTop-65))};
}
function addNode(type,x,y,values={}) {
 const d=getDef(type); if(!d)return;
 const center=defaultNodePosition();
 const n={id:nextNode++,type,x:x??center.x,y:y??center.y,values:{}};
 (d.fields||[]).forEach(f=>n.values[f.id]=values[f.id]??f.default??(f.options?f.options[0][0]:""));
 if(type==="getvar"||type==="setvar") n.values.variable=values.variable??variables[0]?.id??"";
 nodes.push(n);selectedNode=n.id;renderAll();return n;
}
function customPortTypes(){const all=BlueprintTypes.all||[];return [...new Set([...all,...all.map(t=>"List<"+t+">"),"object","UnityEngine.Object","Dictionary<string, GameObject>","GameObject[]","Transform[]","Vector3[]"])].sort((a,b)=>a.localeCompare(b))}
function customPortDefault(type){if(type==="string")return "";if(type==="bool")return "false";if(["int","float","double","decimal","long","short","byte","uint","ulong","LayerMask"].includes(type))return "0";if(["Vector2","Vector3","Vector4","Vector2Int","Vector3Int"].includes(type))return type+".zero";if(type==="Quaternion")return "Quaternion.identity";if(type==="Color")return "Color.white";if(type==="Color32")return "new Color32(255,255,255,255)";if(type==="Rect")return "new Rect()";if(type==="Bounds")return "new Bounds()";if(type==="JointMotor")return "new JointMotor()";if(type==="JointMotor2D")return "new JointMotor2D()";if(type==="JointSpring")return "new JointSpring()";if(type==="JointLimits")return "new JointLimits()";if(type==="JointAngleLimits2D")return "new JointAngleLimits2D()";if(type==="SoftJointLimit")return "new SoftJointLimit()";if(type==="SoftJointLimitSpring")return "new SoftJointLimitSpring()";if(type.startsWith("List<"))return "[]";if(type.endsWith("[]"))return "Array.Empty<"+type.slice(0,-2)+">()";return "null"}
function saveCurrentCustomDefinition(){
 if(!customEditingId)return;
 const def=customBlocks.find(x=>x.id===customEditingId);if(!def)return;
 def.nodes=JSON.parse(JSON.stringify(nodes));def.links=JSON.parse(JSON.stringify(links));def.variables=JSON.parse(JSON.stringify(variables));def.nextNode=nextNode;def.nextVariable=nextVariable;
 const input=def.nodes.find(n=>n.type==="custominput"),output=def.nodes.find(n=>n.type==="customoutput");
 def.inputs=input?.values?.ports||[];def.outputs=output?.values?.ports||[];
 syncCustomDefs();saveCustomBlocks();
}
function openCreateCustomBlock(){
 const name=(prompt("Name your new custom node:","My Custom Node")||"").trim();
 if(!name)return;
 if(customBlocks.some(b=>b.name.toLowerCase()===name.toLowerCase())){alert("A custom node with that name already exists.");return}
 const id="custom_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7);
 customBlocks.push({id,name,color:"#d09aff",description:"Reusable custom block",nodes:[{id:1,type:"custominput",x:100,y:120,values:{ports:[]}},{id:2,type:"customoutput",x:560,y:120,values:{ports:[]}}],links:[],variables:[],nextNode:3,nextVariable:1});
 saveCustomBlocks();syncCustomDefs();enterCustomEditor(id);
}
function enterCustomEditor(id){
 const def=customBlocks.find(x=>x.id===id);if(!def)return;
 if(customEditingId){
  if(customEditingId===id||customEditorStack.some(x=>x.editingId===id)){status("A custom block cannot edit itself recursively");return}
  saveCurrentCustomDefinition();
  customEditorStack.push({editingId:customEditingId,state:{nodes,links,variables,nextNode,nextVariable,selectedNode,scrollLeft:$("workspace").scrollLeft,scrollTop:$("workspace").scrollTop}});
 }else{
  customParentState={nodes,links,variables,nextNode,nextVariable,selectedNode,projectName:$("projectName").value,scrollLeft:$("workspace").scrollLeft,scrollTop:$("workspace").scrollTop};
 }
 customEditingId=id;
 nodes=JSON.parse(JSON.stringify(def.nodes||[]));links=JSON.parse(JSON.stringify(def.links||[]));variables=JSON.parse(JSON.stringify(def.variables||[]));
 nextNode=def.nextNode||Math.max(0,...nodes.map(n=>Number(n.id)||0))+1;nextVariable=def.nextVariable||variables.length+1;
 if(!nodes.some(n=>n.type==="custominput"))nodes.unshift({id:nextNode++,type:"custominput",x:100,y:120,values:{ports:[]}});
 if(!nodes.some(n=>n.type==="customoutput"))nodes.push({id:nextNode++,type:"customoutput",x:560,y:120,values:{ports:[]}});
 selectedNode=nodes.find(n=>n.type==="custominput")?.id||nodes[0]?.id||null;
 $("exitCustomEditor").hidden=false;$("exitCustomEditor").textContent=customEditorStack.length?"Save & Return":"Save & Exit Custom";$("projectName").disabled=true;document.querySelector(".top-actions").style.display="none";
 $("workspace").scrollTo({left:0,top:0,behavior:"auto"});status("Editing custom node: "+def.name);renderAll();
}
function exitCustomEditor(){
 if(!customEditingId)return;
 const def=customBlocks.find(x=>x.id===customEditingId);saveCurrentCustomDefinition();
 if(customEditorStack.length){
  const parent=customEditorStack.pop(),parentDef=customBlocks.find(x=>x.id===parent.editingId),state=parent.state;
  customEditingId=parent.editingId;nodes=state.nodes;links=state.links;variables=state.variables;nextNode=state.nextNode;nextVariable=state.nextVariable;selectedNode=state.selectedNode;
  syncCustomDefs();$("exitCustomEditor").textContent=customEditorStack.length?"Save & Return":"Save & Exit Custom";renderAll();status("Returned to custom node: "+(parentDef?.name||"Custom Node"));return;
 }
 const parent=customParentState;customEditingId=null;customParentState=null;
 if(parent){nodes=parent.nodes;links=parent.links;variables=parent.variables;nextNode=parent.nextNode;nextVariable=parent.nextVariable;selectedNode=parent.selectedNode;
  $("projectName").value=parent.projectName||"My Blueprint Project";$("projectName").disabled=false;$("workspace").scrollTo({left:parent.scrollLeft||0,top:parent.scrollTop||0,behavior:"auto"});
 }
 $("exitCustomEditor").hidden=true;document.querySelector(".top-actions").style.display="flex";
 syncCustomDefs();renderAll();status("Saved custom node: "+(def?.name||"Custom Node"));
}
function addCustomPort(boundary,portType){
 const port={id:"port_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,5),name:(boundary.type==="custominput"?"Input":"Output")+(boundary.values.ports.length+1),type:portType||"float",default:customPortDefault(portType||"float")};
 boundary.values.ports.push(port);renderAll();
}
function addVariable(v={}) {
 const name=(v.name||"Variable"+nextVariable).trim();
 if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)){alert("Use a C# variable name: letters, numbers and underscores, starting with a letter or underscore.");return}
 if(variables.some(x=>x.name===name)){alert("A variable with that name already exists.");return}
 const type=v.type||"int";
 const item={id:v.id||"v"+nextVariable++,name,type,access:v.access||"private-inspector",initial:v.initial??BlueprintTypes.defaultValue(type)};
 variables.push(item);
 nodes.filter(n=>["getvar","setvar"].includes(n.type)&&!n.values.variable).forEach(n=>n.values.variable=item.id);
 renderAll();return item;
}
function openVariableModal(existing=null) {
 $("modalConfirm").hidden=false;$("modalCancel").textContent="Cancel";$("modalCancel").onclick=()=>$("modal").hidden=true;
 $("modalTitle").textContent=existing?"Edit variable":"Create variable";
 $("modalConfirm").textContent=existing?"Save":"Create";
 $("modalBody").innerHTML='<div class="form-row"><label>Variable name</label><input id="varName" value="'+esc(existing?.name||"")+'" placeholder="MoveSpeed"></div><div class="form-row"><label>Data type</label><select id="varType">'+BlueprintTypes.all.map(t=>'<option '+(t===(existing?.type||"float")?"selected":"")+'>'+esc(t)+'</option>').join("")+'<option value="Vector2">Vector2</option><option value="Vector3">Vector3</option><option value="Vector4">Vector4</option><option value="List<int>">List&lt;int&gt;</option><option value="List<float>">List&lt;float&gt;</option><option value="List<string>">List&lt;string&gt;</option><option value="List<GameObject>">List&lt;GameObject&gt;</option><option value="List<Transform>">List&lt;Transform&gt;</option><option value="List<MonoBehaviour>">List&lt;MonoBehaviour&gt;</option><option value="List<Vector2>">List&lt;Vector2&gt;</option><option value="List<Vector3>">List&lt;Vector3&gt;</option><option value="List<Vector4>">List&lt;Vector4&gt;</option><option value="Dictionary<string, GameObject>">Dictionary&lt;string, GameObject&gt;</option><option value="GameObject[]">GameObject[]</option><option value="Transform[]">Transform[]</option><option value="Vector3[]">Vector3[]</option></select></div><div class="form-row"><label>Inspector and access</label><select id="varAccess"><option value="private-inspector">Private, visible in Inspector</option><option value="public-inspector">Public, visible in Inspector</option><option value="private">Private, hidden in Inspector</option><option value="public-hidden">Public, hidden from Inspector</option></select></div><div class="form-row"><label>Initial C# value</label><input id="varInitial" value="'+esc(existing?.initial??"")+'" placeholder="Leave empty for the type default"></div><div class="subtle">Use a valid C# expression. Examples: 100, 5f, true, "Player", Vector3.zero, new List&lt;int&gt;().</div>';
 $("varAccess").value=existing?.access||"private-inspector";
 $("modal").hidden=false;
 $("modalConfirm").onclick=()=>{const data={name:$("varName").value,type:$("varType").value,access:$("varAccess").value,initial:$("varInitial").value.trim()||BlueprintTypes.defaultValue($("varType").value)};if(existing){if(variables.some(v=>v.id!==existing.id&&v.name===data.name)){alert("That variable name already exists.");return}Object.assign(existing,data)}else{const made=addVariable(data);if(!made)return} $("modal").hidden=true;renderAll()};
}
function renderCategories(){ $("categories").innerHTML=allCategories.map(c=>'<button class="category '+(c===activeCategory?"active":"")+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join("");$("categories").querySelectorAll("button").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;renderCategories();renderBlocks()})}
function blockSearchText(d){return [d.name,d.category,d.desc,...(d.aliases||[]),...(d.fields||[]).flatMap(f=>[f.label,...(f.options||[]).map(o=>o[1])])].join(" ").toLowerCase()}
function blockSearchScore(d,q){
 const name=String(d.name||"").toLowerCase(),aliases=(d.aliases||[]).map(a=>String(a).toLowerCase()),text=blockSearchText(d);
 if(name===q)return 1200;
 if(name.startsWith(q))return 1050;
 if(name.includes(q))return 900;
 if(aliases.some(a=>a===q))return 850;
 if(aliases.some(a=>a.startsWith(q)))return 760;
 if(aliases.some(a=>a.includes(q)))return 650;
 const terms=q.split(/\\s+/).filter(Boolean);
 const nameHits=terms.filter(t=>name.includes(t)).length;
 const aliasHits=terms.filter(t=>aliases.some(a=>a.includes(t))).length;
 const textHits=terms.filter(t=>text.includes(t)).length;
 return (nameHits/terms.length)*600+(aliasHits/terms.length)*430+(textHits/terms.length)*240;
}
function renderBlocks(){
 const q=$("blockSearch").value.toLowerCase().trim();
 const filtered=defs.filter(d=>!["custominput","customoutput"].includes(d.id)&&(q||activeCategory==="All"||d.category===activeCategory)&&(!q||blockSearchText(d).includes(q))).sort((a,b)=>{
  if(q){const score=blockSearchScore(b,q)-blockSearchScore(a,q);if(score)return score;}
  return categoryRank(a.category)-categoryRank(b.category)||a.name.localeCompare(b.name);
 });
 const groups=[...new Set(filtered.map(d=>d.category))].sort((a,b)=>{
  if(q){const scoreA=Math.max(...filtered.filter(d=>d.category===a).map(d=>blockSearchScore(d,q)));const scoreB=Math.max(...filtered.filter(d=>d.category===b).map(d=>blockSearchScore(d,q)));if(scoreA!==scoreB)return scoreB-scoreA;}
  return categoryRank(a)-categoryRank(b)||a.localeCompare(b);
 });
 $("blockList").innerHTML=groups.map(category=>'<section class="block-category-section"><div class="block-category-heading"><span>'+esc(category)+'</span><small>'+filtered.filter(d=>d.category===category).length+' blocks</small></div>'+filtered.filter(d=>d.category===category).map(d=>'<button class="block-item" data-type="'+d.id+'" style="--accent:'+d.color+'"><span class="block-dot"></span><span class="block-text"><strong>'+esc(d.name)+'</strong><small>'+esc(d.desc)+'</small></span></button>').join("")+'</section>').join("")||'<div class="subtle">No blocks found. Try a synonym, symbol, or operation name.</div>';
 $("blockList").querySelectorAll("[data-type]").forEach(b=>{
  b.onclick=e=>e.preventDefault();
  b.addEventListener("pointerdown",e=>{
   if(e.button!==0)return;
   e.preventDefault();
   const type=b.dataset.type;if(type==="createcustom"){openCreateCustomBlock();return;}const workspace=$("workspace");
   let draggedNode=null,finished=false;
   const inside=ev=>{const r=workspace.getBoundingClientRect();return ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom};
   function move(ev){
    if(finished||!inside(ev))return;
    const p=canvasPoint(ev.clientX,ev.clientY);
    if(!draggedNode){
     draggedNode=addNode(type,Math.max(0,p.x-120),Math.max(0,p.y-22));
     const el=$("canvas").querySelector('.node[data-id="'+draggedNode.id+'"]');
     if(el){el.style.opacity=".78";el.style.pointerEvents="none";}
    }else{
     draggedNode.x=Math.max(0,Math.min(26900,p.x-120));
     draggedNode.y=Math.max(0,Math.min(26900,p.y-22));
     const el=$("canvas").querySelector('.node[data-id="'+draggedNode.id+'"]');
     if(el){el.style.left=draggedNode.x+"px";el.style.top=draggedNode.y+"px";}
     drawWires();
    }
   }
   function cleanup(){window.removeEventListener("pointermove",move,true);window.removeEventListener("pointerup",end,true);window.removeEventListener("pointercancel",cancel,true);}
   function end(ev){
    if(finished)return;finished=true;cleanup();
    if(!draggedNode)return;
    if(!inside(ev)){nodes=nodes.filter(n=>n.id!==draggedNode.id);links=links.filter(l=>l.from!==draggedNode.id&&l.to!==draggedNode.id);selectedNode=null;renderAll();return;}
    renderAll();status("Node placed");
   }
   function cancel(){if(finished)return;finished=true;cleanup();if(draggedNode){nodes=nodes.filter(n=>n.id!==draggedNode.id);selectedNode=null;renderAll();}}
   window.addEventListener("pointermove",move,true);
   window.addEventListener("pointerup",end,true);
   window.addEventListener("pointercancel",cancel,true);
  });
 });
 $("blockTotal").textContent=filtered.length;
}
const componentProperties={
Joint:[["connectedBody","Connected Body"],["anchor","Anchor"],["connectedAnchor","Connected Anchor"],["autoConfigureConnectedAnchor","Auto Configure Connected Anchor"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["enablePreprocessing","Enable Preprocessing"],["massScale","Mass Scale"],["connectedMassScale","Connected Mass Scale"]],
FixedJoint:[["connectedBody","Connected Body"],["anchor","Anchor"],["connectedAnchor","Connected Anchor"],["autoConfigureConnectedAnchor","Auto Configure Connected Anchor"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["enablePreprocessing","Enable Preprocessing"],["massScale","Mass Scale"],["connectedMassScale","Connected Mass Scale"]],
SpringJoint:[["connectedBody","Connected Body"],["anchor","Anchor"],["connectedAnchor","Connected Anchor"],["autoConfigureConnectedAnchor","Auto Configure Connected Anchor"],["spring","Spring"],["damper","Damper"],["minDistance","Minimum Distance"],["maxDistance","Maximum Distance"],["tolerance","Tolerance"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["enablePreprocessing","Enable Preprocessing"]],
HingeJoint:[["limits","Limits (Minimum / Maximum)"],["useLimits","Use Limits"],["motor","Motor"],["spring","Spring"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["enablePreprocessing","Enable Preprocessing"],["connectedBody","Connected Body"]],
HingeJoint2D:[["limits","Limits (Minimum / Maximum)"],["useLimits","Use Limits"],["useMotor","Use Motor"],["useSpring","Use Spring"],["motor","Motor"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["connectedBody","Connected Body"]],
CharacterJoint:[["connectedBody","Connected Body"],["swingAxis","Swing Axis"],["lowTwistLimit","Low Twist Limit"],["highTwistLimit","High Twist Limit"],["swing1Limit","Swing 1 Limit"],["swing2Limit","Swing 2 Limit"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"],["enablePreprocessing","Enable Preprocessing"]],
ConfigurableJoint:[["connectedBody","Connected Body"],["xMotion","X Motion"],["yMotion","Y Motion"],["zMotion","Z Motion"],["angularXMotion","Angular X Motion"],["angularYMotion","Angular Y Motion"],["angularZMotion","Angular Z Motion"],["targetPosition","Target Position"],["targetVelocity","Target Velocity"],["targetRotation","Target Rotation"],["targetAngularVelocity","Target Angular Velocity"],["linearLimit","Linear Limit"],["lowAngularXLimit","Low Angular X Limit"],["highAngularXLimit","High Angular X Limit"],["angularYLimit","Angular Y Limit"],["angularZLimit","Angular Z Limit"],["configuredInWorldSpace","Configured In World Space"],["swapBodies","Swap Bodies"],["projectionDistance","Projection Distance"],["projectionAngle","Projection Angle"]],
Joint2D:[["connectedBody","Connected Body"],["anchor","Anchor"],["connectedAnchor","Connected Anchor"],["autoConfigureConnectedAnchor","Auto Configure Connected Anchor"],["breakForce","Break Force"],["breakTorque","Break Torque"],["enableCollision","Enable Collision"]],
Rigidbody:[["mass","Mass"],["drag","Drag"],["angularDrag","Angular Drag"],["useGravity","Use Gravity"],["isKinematic","Is Kinematic"],["detectCollisions","Detect Collisions"],["constraints","Constraints"]],
Rigidbody2D:[["mass","Mass"],["gravityScale","Gravity Scale"],["linearDamping","Linear Damping"],["angularDamping","Angular Damping"],["simulated","Simulated"],["bodyType","Body Type"],["constraints","Constraints"]],
Transform:[["position","Position"],["localPosition","Local Position"],["rotation","Rotation"],["localRotation","Local Rotation"],["localScale","Local Scale"]],
Collider:[["enabled","Enabled"],["isTrigger","Is Trigger"]],
Collider2D:[["enabled","Enabled"],["isTrigger","Is Trigger"]],
BoxCollider:[["enabled","Enabled"],["isTrigger","Is Trigger"],["center","Center"],["size","Size"]],
SphereCollider:[["enabled","Enabled"],["isTrigger","Is Trigger"],["center","Center"],["radius","Radius"]],
CapsuleCollider:[["enabled","Enabled"],["isTrigger","Is Trigger"],["center","Center"],["radius","Radius"],["height","Height"],["direction","Direction"]],
MeshCollider:[["enabled","Enabled"],["isTrigger","Is Trigger"],["sharedMesh","Shared Mesh"],["convex","Convex"]],
BoxCollider2D:[["enabled","Enabled"],["isTrigger","Is Trigger"],["offset","Offset"],["size","Size"]],
CircleCollider2D:[["enabled","Enabled"],["isTrigger","Is Trigger"],["offset","Offset"],["radius","Radius"]],
CapsuleCollider2D:[["enabled","Enabled"],["isTrigger","Is Trigger"],["offset","Offset"],["size","Size"],["direction","Direction"]],
CharacterController:[["enabled","Enabled"],["height","Height"],["radius","Radius"],["center","Center"],["slopeLimit","Slope Limit"],["stepOffset","Step Offset"],["skinWidth","Skin Width"],["minMoveDistance","Minimum Move Distance"],["detectCollisions","Detect Collisions"],["enableOverlapRecovery","Enable Overlap Recovery"]],
ConstantForce:[["force","Force"],["relativeForce","Relative Force"],["torque","Torque"],["relativeTorque","Relative Torque"]],
Animator:[["enabled","Enabled"],["applyRootMotion","Apply Root Motion"],["speed","Speed"],["updateMode","Update Mode"],["cullingMode","Culling Mode"]],
AudioSource:[["volume","Volume"],["pitch","Pitch"],["loop","Loop"],["playOnAwake","Play On Awake"],["mute","Mute"]],
Camera:[["fieldOfView","Field Of View"],["orthographic","Orthographic"],["orthographicSize","Orthographic Size"],["nearClipPlane","Near Clip Plane"],["farClipPlane","Far Clip Plane"]],
Light:[["intensity","Intensity"],["range","Range"],["color","Color"],["enabled","Enabled"]],
NavMeshAgent:[["speed","Speed"],["angularSpeed","Angular Speed"],["acceleration","Acceleration"],["stoppingDistance","Stopping Distance"],["isStopped","Is Stopped"]],
WheelCollider:[["motorTorque","Motor Torque"],["brakeTorque","Brake Torque"],["steerAngle","Steer Angle"]],
SpriteRenderer:[["enabled","Enabled"],["color","Color"],["flipX","Flip X"],["flipY","Flip Y"],["sortingOrder","Sorting Order"],["sprite","Sprite"]],
MeshRenderer:[["enabled","Enabled"],["receiveShadows","Receive Shadows"],["shadowCastingMode","Shadow Casting Mode"],["sortingOrder","Sorting Order"]],
ParticleSystem:[["loop","Loop"],["playOnAwake","Play On Awake"],["simulationSpeed","Simulation Speed"]]
};
const boolProperties=new Set(["useLimits","useMotor","useSpring","autoConfigureConnectedAnchor","configuredInWorldSpace","swapBodies","enableCollision","enablePreprocessing","useGravity","isKinematic","detectCollisions","enableOverlapRecovery","simulated","isTrigger","enabled","loop","playOnAwake","mute","orthographic","isStopped","convex","applyRootMotion","flipX","flipY","receiveShadows"]);
function literalIsList(n){return /^List<.+>$/.test(String(n?.values?.type||""));}
function literalListElement(n){return String(n.values.type).slice(5,-1);}
function literalListValues(n){try{const a=JSON.parse(n.values.value||"[]");return Array.isArray(a)?a.map(v=>String(v??"")):[];}catch{return [];}}
function literalListEditor(n,inspector){const values=literalListValues(n),elementType=literalListElement(n),attr=inspector?"data-list-item":"data-list-node",add=inspector?"data-list-add-inspector":"data-list-add-node",remove=inspector?"data-list-remove-inspector":"data-list-remove-node";let html='<div class="literal-list-editor"><div class="literal-list-heading"><strong>Elements ('+values.length+')</strong><button type="button" '+add+'>+ Add</button></div>';values.forEach((v,i)=>{let control;if(elementType==="bool")control='<input type="checkbox" '+attr+'="'+i+'" '+(v==="true"?"checked":"")+' aria-label="Element '+i+'">';else{const numeric=["int","long","float","double","decimal","short","byte","uint","ulong","ushort","sbyte"].includes(elementType),whole=["int","long","short","byte","uint","ulong","ushort","sbyte"].includes(elementType),step=whole?"1":elementType==="float"?"0.01":"any";control='<input type="'+(numeric?"number":"text")+'" '+attr+'="'+i+'" '+(numeric?'step="'+step+'"':"")+' value="'+esc(v)+'" placeholder="Element '+i+'">';}html+='<div class="literal-list-item"><label>Element '+i+'</label>'+control+'<button type="button" '+remove+'="'+i+'" aria-label="Remove element '+i+'">×</button></div>';});if(!values.length)html+='<p class="subtle">List is empty.</p>';return html+'</div>';}
function fieldHtml(n,f){
 let val=n.values[f.id]??f.default??"";
 if(["changerotation","changeposition"].includes(n.type)&&["x","y","z","w"].includes(f.id)){
  const link=links.find(l=>l.kind==="data"&&l.to===n.id&&l.toPin===f.id);
  if(link){
   const source=getNode(link.from),sourceDef=getDef(source?.type);
   const sourceName=sourceDef?.name||"Connected node";
   return '<div class="node-field connected-value"><span>'+esc(f.label)+'</span><div class="connected-field-value" title="Connected to '+esc(sourceName)+'"><span class="connection-indicator"></span><span>'+esc(sourceName)+'</span><span class="connected-lock">Connected</span></div></div>';
  }
 }
 if(n.type==="literal"&&["x","y","z","w"].includes(f.id))return "";
 if(n.type==="vector"){
  const type=n.values.vectorType||"Vector3";
  if(f.id==="z"&&type==="Vector2")return "";
  if(f.id==="w"&&["Vector2","Vector3"].includes(type))return "";
 }
 if(n.type==="vector"&&f.id==="z"&&n.values.vectorType==="Vector2")return "";
 if(n.type==="vector"&&f.id==="w"&&["Vector2","Vector3"].includes(n.values.vectorType))return "";
 if(n.type==="setcomponent"&&f.type==="checkbox")return "";
 if(f.type==="checkbox"){
  const connected=links.some(l=>l.kind==="data"&&l.to===n.id&&l.toPin===f.id);
  if(connected)return '<div class="node-field connected-value"><span>'+esc(f.label)+'</span><div class="connected-field-value"><span class="connection-indicator"></span><span class="connected-lock">Connected</span></div></div>';
  return '<label class="node-field checkbox-field"><span>'+esc(f.label)+'</span><input data-field="'+f.id+'" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';
 }
 if(f.type==="variable"){
  const expected=n.type==="setcomponent"&&f.id==="componentVariable"?(n.values.componentType||"Component"):(f.expected||null);
  const list=variables.filter(v=>f.allowAll&&n.type!=="setcomponent"||!expected||v.type===expected||v.type==="Component"||v.type==="MonoBehaviour"||v.type==="object"||(n.type==="setcomponent"&&BlueprintTypes.unity.includes(v.type)));
  return '<label class="node-field"><span>'+esc(f.label)+'</span><select data-field="'+f.id+'"><option value="">Choose variable…</option>'+list.map(v=>'<option value="'+v.id+'" '+(val===v.id?"selected":"")+'>'+esc(v.name)+' · '+esc(v.type)+'</option>').join("")+'</select></label>';
 }
 if(f.type==="select")return '<label class="node-field"><span>'+esc(f.label)+'</span><select data-field="'+f.id+'">'+f.options.map(o=>'<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?"selected":"")+'>'+esc(o[1])+'</option>').join("")+'</select></label>';
 if(n.type==="literal"&&f.id==="value"&&literalIsList(n))return literalListEditor(n,false);
  if(n.type==="literal"&&f.id==="value"&&(n.values.type||"int")==="bool")return '<label class="node-field checkbox-field"><span>Value</span><input data-field="value" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';
 const literalType=n.type==="literal"&&f.id==="value"?(n.values.type||"int"):null;
 const type=["int","float","double","long"].includes(literalType)||f.type==="number"?"number":"text";
 const step=literalType==="int"||literalType==="long"?"1":literalType==="float"||literalType==="double"?"any":"";
 return '<label class="node-field"><span>'+esc(f.label)+'</span><input data-field="'+f.id+'" type="'+type+'" '+(step?'step="'+step+'"':"")+' value="'+esc(val)+'"></label>';
}
function renderNodes(){
 document.querySelectorAll(".node").forEach(e=>e.remove());
 nodes.forEach(n=>{
  const d=getDef(n.type);if(!d)return;
  const el=document.createElement("div");el.className="node"+(selectedNode===n.id?" selected":"");el.dataset.id=n.id;el.style.left=n.x+"px";el.style.top=n.y+"px";el.style.setProperty("--accent",n.color||d.color);
  let html='<div class="node-head"><span class="node-accent"></span>'+esc(d.name)+'</div>';
  if(d.flowIn&&!(n.type==="if"&&(n.values?.branchMode||"Exec")!=="Exec"))d.flowIn.forEach(p=>html+='<div class="pin-row flow-input-row exec-input-top"><span class="pin-label"><button class="pin in exec-pin" data-direction="input" data-kind="flow" data-type="exec" data-pin="'+p+'" title="Execution input"></button>'+esc(p)+'</span></div>');
  html+='<div class="node-body">';
  html+='<div class="node-description">'+esc(d.desc)+'</div>';
  (d.fields||[]).forEach(f=>{html+=fieldHtml(n,f)});
  if(n.type==="setcomponent"){
   const chosen=n.values.componentVariable||"";
   const componentVars=variables.filter(v=>BlueprintTypes.unity.includes(v.type));
   html+='<label class="node-field"><span>Component variable</span><select data-field="componentVariable"><option value="">Use connected input…</option>'+componentVars.map(v=>'<option value="'+v.id+'" '+(chosen===v.id?"selected":"")+'">'+esc(v.name)+' · '+esc(v.type)+'</option>').join("")+'</select></label>';
   const ct=connectedComponentType(n);
   if(ct)(componentProperties[ct]||[]).forEach(([id,label])=>{
    const checked=n.values["use_"+id]==="true";
    html+='<label class="node-field checkbox-field component-toggle"><span>'+esc(label)+'</span><input data-field="use_'+id+'" type="checkbox" '+(checked?"checked":"")+'></label>';
   });
  }
  nodeInputs(n).filter(p=>n.type==="setcomponent"&&p.id!=="component"?true:inputActive(n,p)).forEach(p=>{
    const inputType=displayInputType(n,p),pinType=inputType==="any"?"dynamic":inputType;
    html+='<div class="pin-row input-row"><span class="pin-label"><button class="pin in" data-direction="input" data-kind="data" data-type="'+esc(pinType)+'" data-pin="'+p.id+'" title="Drag to connect input"></button><span class="pin-name">'+esc(p.label)+'</span><span class="pin-type-badge input-type-badge">'+esc(inputType)+'</span></span></div>';
   });
   if(n.type==="getcomponentvalue"||n.type==="vectorsplit3"||n.type==="vectorsplit2"||n.type==="quaternionsplit"||n.type==="foreach"||n.type==="custominput"||String(n.type).startsWith("customblock_")){
    const outs=nodeOutputs(n);
    if(n.type==="getcomponentvalue"&&!connectedComponentType(n))html+='<div class="node-description">Connect a typed component to show its properties.</div>';
    outs.forEach(p=>{html+='<div class="pin-row output-row"><span class="output-info"><span class="output-name">'+esc(p.label)+'</span><span class="pin-type-badge output-type-badge">'+esc(p.type)+'</span></span><button class="pin out" data-direction="output" data-kind="data" data-type="'+esc(p.type)+'" data-pin="'+p.id+'" title="Drag to connect '+esc(p.label)+'"></button></div>'})
   }
   if(d.valueOut&&actualOutputType(n)!=="none"&&n.type!=="getcomponentvalue"){
    const outputType=actualOutputType(n);
    const outputLabel=outputType==="dynamic"?(n.type==="getvar"?"Choose variable":"Select type"):outputType;
    html+='<div class="pin-row output-row"><span class="output-info"><span class="output-name">'+esc(n.type==="foreach"?"Current element":"Output")+'</span><span class="pin-type-badge output-type-badge">'+esc(outputLabel)+'</span></span><button class="pin out" data-direction="output" data-kind="data" data-type="'+esc(outputType)+'" data-pin="'+(n.type==="foreach"?"item":"value")+'" title="Drag to connect output"></button></div>';
   }
   if(d.flowOut&&!(n.type==="if"&&(n.values?.branchMode||"Exec")!=="Exec")&&!(n.type==="foreach"&&(n.values?.mode||"Loop")==="GetElement"))d.flowOut.forEach(p=>html+='<div class="pin-row flow-output-row"><span class="output-name">'+esc(p)+'</span><button class="pin out exec-pin" data-direction="output" data-kind="flow" data-type="exec" data-pin="'+p+'" title="Drag to connect output"></button></div>');
  html+='</div>';el.innerHTML=html;
  el.addEventListener("pointerdown",e=>{if(!String(n.type).startsWith("customblock_")||e.target.closest(".pin, input, select, textarea, button, label"))return;const now=Date.now();if(lastCustomNodeClick.id===n.id&&now-lastCustomNodeClick.time<550){lastCustomNodeClick={id:null,time:0};e.preventDefault();e.stopPropagation();enterCustomEditor(String(n.type).slice("customblock_".length));return}lastCustomNodeClick={id:n.id,time:now}},true);
  el.addEventListener("click",e=>{if(e.target.closest(".pin, input, select, textarea, button, label"))return;if(String(n.type).startsWith("customblock_")){lastCustomNodeClick={id:n.id,time:Date.now()};selectedNode=n.id;document.querySelectorAll(".node.selected").forEach(x=>x.classList.remove("selected"));el.classList.add("selected");renderInspector();return}selectedNode=n.id;renderNodes();renderInspector()});
  el.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();if(n.type==="custominput"||n.type==="customoutput"){selectedNode=n.id;renderNodes();renderInspector();return}selectedNode=n.id;showContextMenu(e.clientX,e.clientY,[{label:"Delete node",className:"danger",action:()=>{nodes=nodes.filter(x=>x.id!==n.id);links=links.filter(l=>l.from!==n.id&&l.to!==n.id);if(selectedNode===n.id)selectedNode=null;renderAll();status("Node deleted")}},{label:"Duplicate node",action:()=>{const copy=addNode(n.type,n.x+15,n.y+15,{...n.values});if(copy){copy.color=n.color||"";selectedNode=copy.id;renderAll();status("Node duplicated · moved 15 px down and right")} }},{label:"Node color",submenu:[{label:"Default",color:"",action:()=>setNodeColor(n,"")},{label:"Blue",color:"#648cff",action:()=>setNodeColor(n,"#648cff")},{label:"Green",color:"#43b581",action:()=>setNodeColor(n,"#43b581")},{label:"Yellow",color:"#e0b64f",action:()=>setNodeColor(n,"#e0b64f")},{label:"Orange",color:"#e98b45",action:()=>setNodeColor(n,"#e98b45")},{label:"Red",color:"#df626c",action:()=>setNodeColor(n,"#df626c")},{label:"Purple",color:"#ad7ce8",action:()=>setNodeColor(n,"#ad7ce8")},{label:"Pink",color:"#e783b6",action:()=>setNodeColor(n,"#e783b6")},{label:"Gray",color:"#8e99aa",action:()=>setNodeColor(n,"#8e99aa")}]}]);});
  const head=el.querySelector(".node-head");
  head.addEventListener("pointerdown",e=>{if(e.target.closest("button,input,select"))return;selectedNode=n.id;const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y;head.setPointerCapture?.(e.pointerId);function move(ev){n.x=Math.max(0,Math.min(26900,ox+ev.clientX-sx));n.y=Math.max(0,Math.min(26900,oy+ev.clientY-sy));el.style.left=n.x+"px";el.style.top=n.y+"px";drawWires()}function end(){window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);renderInspector();if(customEditingId)saveCurrentCustomDefinition()}window.addEventListener("pointermove",move);window.addEventListener("pointerup",end);e.preventDefault()});
  el.querySelectorAll("[data-field]").forEach(input=>{
   input.addEventListener(input.type==="checkbox"?"input":"change",()=>{
    const field=input.dataset.field;
    n.values[field]=input.type==="checkbox"?String(input.checked):input.value;if(["raycast","spherecast","overlapsphere"].includes(n.type)&&field==="showDebug"&&n.values.showDebug!=="true"&&!links.some(l=>l.kind==="data"&&l.to===n.id&&l.toPin==="showDebug"))links=links.filter(l=>!(l.kind==="data"&&l.to===n.id&&["hitColor","missColor"].includes(l.toPin)));if(n.type==="literal"&&field==="value"&&n.values.type==="int"&&input.type!=="checkbox"){n.values[field]=String(Math.trunc(Number(input.value)||0));input.value=n.values[field]}
    const componentField=field.startsWith("use_")&&n.type==="setcomponent";
    const rebuildNode=componentField||field==="component"||field==="componentVariable";
    const operationChangesOutput=field==="operation"&&["transform","gameobject"].includes(n.type);
    const pinTypeChange=["type","variable","componentType","fromType","toType","outputType","operandType","vectorType","aType","bType","branchMode"].includes(field)||operationChangesOutput;
    if(pinTypeChange||rebuildNode){
     removeIncompatibleLinksForOutput(n.id);
     removeIncompatibleLinksForInput(n.id);
    }
    if(componentField){
     pruneIncompatibleLinks();
     renderNodes();
     renderInspector();
     renderCode();
    }else renderAll();
   });
  });
  el.querySelectorAll(".pin").forEach(pin=>{
   pin.addEventListener("pointerdown",e=>{
    e.stopPropagation();
    if(pin.dataset.direction==="input"||pin.dataset.direction==="output"){
     e.preventDefault();
     beginWireDrag(e,n,pin);
    }
   });
   pin.addEventListener("click",e=>{e.preventDefault();e.stopPropagation()});
  });
  $("canvas").appendChild(el);
 });
 $("emptyState").style.display=nodes.length?"none":"flex";
 $("nodeCount")?.remove();
 drawWires();
}
let wireDrag=null;
function canvasPoint(clientX,clientY){const r=$("canvas").getBoundingClientRect();return{x:clientX-r.left,y:clientY-r.top}}
function beginWireDrag(e,node,pin){
 if(e.button!==undefined&&e.button!==0)return;
 if(wireDrag)finishWireDrag(null,true);
 const isOutput=pin.dataset.direction==="output";
 const start=pinPos(node.id,pin.dataset.kind,isOutput,pin.dataset.pin);if(!start)return;
 const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("class","wire wire-preview");path.style.pointerEvents="none";path.style.stroke="#efbd70";path.style.strokeWidth="3";$("wires").appendChild(path);
 wireDrag={node:node.id,kind:pin.dataset.kind,pin:pin.dataset.pin,type:pin.dataset.type||"dynamic",direction:isOutput?"output":"input",start,path,pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY,autoScrollFrame:0};
 wireDrag.autoScrollFrame=requestAnimationFrame(autoScrollWireDrag);
 window.addEventListener("pointermove",moveWireDrag);
 window.addEventListener("pointerup",endWireDrag,{once:true});
 window.addEventListener("pointercancel",cancelWireDrag,{once:true});
 moveWireDrag(e);status(isOutput?"Drag the output to a compatible input":"Drag the input to an output");
}
function moveWireDrag(e){
 if(!wireDrag)return;
 wireDrag.clientX=e.clientX;
 wireDrag.clientY=e.clientY;
 const cursor=canvasPoint(e.clientX,e.clientY);
 const a=wireDrag.direction==="output"?wireDrag.start:cursor;
 const b=wireDrag.direction==="output"?cursor:wireDrag.start;
 const dx=Math.max(45,Math.abs(b.x-a.x)*.45);
 wireDrag.path.setAttribute("d","M "+a.x+" "+a.y+" C "+(a.x+dx)+" "+a.y+" "+(b.x-dx)+" "+b.y+" "+b.x+" "+b.y);
 document.querySelectorAll(".node .pin.snap-target").forEach(pin=>pin.classList.remove("snap-target"));
 const target=findSnapTarget(e.clientX,e.clientY,true);if(target)target.pin.classList.add("snap-target");
}
function autoScrollWireDrag(){
 if(!wireDrag)return;
 const workspace=$("workspace"),r=workspace.getBoundingClientRect(),x=wireDrag.clientX,y=wireDrag.clientY,edge=58,maxSpeed=18;
 let dx=0,dy=0;
 if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){
  if(x-r.left<edge)dx=-maxSpeed*(1-(x-r.left)/edge);
  else if(r.right-x<edge)dx=maxSpeed*(1-(r.right-x)/edge);
  if(y-r.top<edge)dy=-maxSpeed*(1-(y-r.top)/edge);
  else if(r.bottom-y<edge)dy=maxSpeed*(1-(r.bottom-y)/edge);
 }
 if(dx||dy){
  workspace.scrollLeft+=dx;
  workspace.scrollTop+=dy;
  moveWireDrag({clientX:x,clientY:y});
 }
 wireDrag.autoScrollFrame=requestAnimationFrame(autoScrollWireDrag);
}
function findSnapTarget(x,y,requireNear=true){
 if(!wireDrag)return null;
 const targetDirection=wireDrag.direction==="output"?"input":"output";
 let best=null,bestDist=Infinity;
 document.querySelectorAll('.node .pin[data-direction="'+targetDirection+'"]').forEach(pin=>{
  const nodeEl=pin.closest(".node"),nodeId=Number(nodeEl?.dataset.id);
  if(!nodeEl||nodeId===wireDrag.node||pin.dataset.kind!==wireDrag.kind)return;
  if(wireDrag.kind==="data"){
   let source,target,input;
   if(wireDrag.direction==="output"){
    source=getNode(wireDrag.node);target=getNode(nodeId);
    input=nodeInputs(target).find(p=>p.id===pin.dataset.pin);
   }else{
    source=getNode(nodeId);target=getNode(wireDrag.node);
    input=nodeInputs(target).find(p=>p.id===wireDrag.pin);
   }
   if(!source||!target||!input||!typesCompatible(actualOutputType(source,wireDrag.direction==="output"?wireDrag.pin:pin.dataset.pin),expectedInputType(target,input)))return;
  }
  const r=pin.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(cx-x,cy-y);
  if(d<bestDist){bestDist=d;best={pin,nodeId,distance:d}}
 });
 return best&&(!requireNear||bestDist<=100)?best:null;
}
function endWireDrag(e){
 if(!wireDrag)return;
 const target=e?findSnapTarget(e.clientX,e.clientY,true):null;
 finishWireDrag(target,false);
}
function cancelWireDrag(){finishWireDrag(null,true)}
function finishWireDrag(target,cancelled){
 if(!wireDrag)return;
 const drag=wireDrag;wireDrag=null;
 if(drag.autoScrollFrame)cancelAnimationFrame(drag.autoScrollFrame);
 window.removeEventListener("pointermove",moveWireDrag);window.removeEventListener("pointerup",endWireDrag);window.removeEventListener("pointercancel",cancelWireDrag);
 document.querySelectorAll(".pin.snap-target").forEach(p=>p.classList.remove("snap-target"));
 drag.path.remove();
 if(target&&!cancelled){
  const fromNode=drag.direction==="output"?drag.node:target.nodeId;
  const fromPin=drag.direction==="output"?drag.pin:target.pin.dataset.pin;
  const toNode=drag.direction==="output"?target.nodeId:drag.node;
  const toPin=drag.direction==="output"?target.pin.dataset.pin:drag.pin;
  links=links.filter(l=>!(l.to===toNode&&l.toPin===toPin&&l.kind===drag.kind));
  links.push({from:fromNode,fromPin,to:toNode,toPin,kind:drag.kind});
  status("Connection added");renderAll();
 }else if(!cancelled)status("No compatible pin nearby; move closer to a matching pin and release");
 drawWires();
}
function pinClick(n,kind,isOut,pin){
 if(!pendingPin){if(!isOut){status("Start at an output pin on the right side of a node");return}pendingPin={node:n.id,kind,pin};renderNodes();document.querySelectorAll('.pin[data-direction="output"]').forEach(p=>p.classList.add("pending"));status("Now click a matching input pin on the left side of another node");return}
 const a=pendingPin;pendingPin=null;
 if(a.node===n.id){status("Choose a different node");renderNodes();return}
 if(kind!==a.kind||isOut){status(isOut?"Connections must go from an output to an input":"Pin types do not match");renderNodes();return}
 const from=getNode(a.node),to=n,fd=getDef(from.type),td=getDef(to.type);
 if(kind==="data"){
  const outType=actualOutputType(from,a.pin), input=nodeInputs(to).find(p=>p.id===pin);
  if(!input||!typesCompatible(outType,expectedInputType(to,input))){status("Incompatible data types");renderNodes();return}
 }
 links=links.filter(l=>!(l.to===n.id&&l.toPin===pin&&l.kind===kind));
 links.push({from:a.node,fromPin:a.pin,to:n.id,toPin:pin,kind});
 status("Connected");renderAll();
}
function pinPos(nodeId,kind,isOut,pin){
 const el=document.querySelector('.node[data-id="'+nodeId+'"]');if(!el)return null;
 const btn=[...el.querySelectorAll(".pin")].find(p=>p.dataset.kind===kind&&p.dataset.pin===pin&&(p.classList.contains("out")===isOut));if(!btn)return null;
 const r=btn.getBoundingClientRect(),c=$("canvas").getBoundingClientRect();
 return {x:r.left+r.width/2-c.left,y:r.top+r.height/2-c.top};
}
function drawWires(){
 const svg=$("wires");svg.innerHTML="";
 links.forEach((l,index)=>{const a=pinPos(l.from,l.kind,true,l.fromPin),b=pinPos(l.to,l.kind,false,l.toPin);if(!a||!b)return;const dx=Math.max(45,Math.abs(b.x-a.x)*.45);const path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d","M "+a.x+" "+a.y+" C "+(a.x+dx)+" "+a.y+" "+(b.x-dx)+" "+b.y+" "+b.x+" "+b.y);path.setAttribute("class","wire");path.dataset.linkIndex=String(index);path.style.pointerEvents="stroke";if(l.kind==="data")path.style.stroke="#8fb3ff";path.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();showContextMenu(e.clientX,e.clientY,[{label:"Unconnect",action:()=>{links.splice(index,1);renderAll();status("Connection removed")}}])});svg.appendChild(path)});
}
function setNodeColor(n,color){n.color=color||"";closeContextMenu();renderNodes();renderInspector();status(color?"Node color changed":"Default node color")}
function closeContextMenu(){document.getElementById("blueprintContextMenu")?.remove();document.removeEventListener("pointerdown",outsideContextMenu,true)}
function outsideContextMenu(e){if(!e.target.closest("#blueprintContextMenu"))closeContextMenu()}
function showContextMenu(x,y,items){
 closeContextMenu();const menu=document.createElement("div");menu.id="blueprintContextMenu";menu.className="blueprint-context-menu";menu.style.left=Math.min(x,window.innerWidth-210)+"px";menu.style.top=Math.min(y,window.innerHeight-80)+"px";
 items.forEach(item=>{const row=document.createElement("button");row.type="button";row.className="context-menu-item"+(item.className?" "+item.className:"");row.textContent=item.label;if(item.color!==undefined){const swatch=document.createElement("span");swatch.className="context-color-swatch";swatch.style.background=item.color||"#202531";row.prepend(swatch)}if(item.submenu){row.classList.add("has-submenu");row.textContent=item.label+"  ›";row.onclick=e=>{e.stopPropagation();const r=row.getBoundingClientRect();showContextMenu(r.right,r.top,item.submenu)}}else row.onclick=()=>{closeContextMenu();item.action()};menu.appendChild(row)});
 document.body.appendChild(menu);const r=menu.getBoundingClientRect();if(r.right>window.innerWidth)menu.style.left=Math.max(4,window.innerWidth-r.width-4)+"px";if(r.bottom>window.innerHeight)menu.style.top=Math.max(4,window.innerHeight-r.height-4)+"px";setTimeout(()=>document.addEventListener("pointerdown",outsideContextMenu,true),0);
}
function renderVariables(){
 const heading=document.querySelector(".variables-panel-heading strong"),description=document.querySelector(".variables-panel-heading p");if(heading)heading.textContent=customEditingId?"CUSTOM BLOCK VARIABLES":"PROJECT VARIABLES";if(description)description.textContent=customEditingId?"These variables are private to each instance of this custom block. Every instance gets its own values.":"Create variables here. Variable blocks use dropdowns, never manually typed names.";
 $("variableList").innerHTML=variables.map(v=>'<div class="variable-card"><div class="variable-top"><strong>'+esc(v.name)+'</strong><span class="type-pill">'+esc(v.type)+'</span></div><div class="variable-meta">'+esc(v.access==="public-hidden"?"Public · hidden from Inspector":v.access==="public-inspector"?"Public · Inspector":v.access==="private"?"Private · hidden":"Private · Inspector")+' · '+esc(v.initial)+'</div><div class="variable-buttons"><button data-edit-var="'+v.id+'">Edit</button><button data-delete-var="'+v.id+'">Delete</button></div></div>').join("")||'<div class="subtle">No variables yet. Create one to use it in Get Variable or Set Variable blocks.</div>';
 $("variableList").querySelectorAll("[data-edit-var]").forEach(b=>b.onclick=()=>openVariableModal(getVar(b.dataset.editVar)));
 $("variableList").querySelectorAll("[data-delete-var]").forEach(b=>b.onclick=()=>{const id=b.dataset.deleteVar;variables=variables.filter(v=>v.id!==id);nodes.forEach(n=>{if(n.values.variable===id)n.values.variable="";if(n.values.componentVariable===id)n.values.componentVariable=""});links=links.filter(l=>!((getNode(l.from)?.type==="getvar"||getNode(l.to)?.type==="setvar")&&l.kind==="data"));renderAll()});
}
function renderInspector(){
 const n=getNode(selectedNode);if(!n){$("nodeInspector").innerHTML='<p class="subtle">Select a node to edit its settings.</p>';return}
 const d=getDef(n.type);
 let html='<div class="subtle">'+esc(d.name)+' · '+esc(d.category)+'</div>';
 (d.fields||[]).forEach(f=>{if(n.type==="setcomponent"&&f.type==="checkbox")return;if(n.type==="raycast"&&((f.id==="tag"&&n.values.tagMode!=="tag")||(f.id==="tags"&&n.values.tagMode!=="tags")))return;let val=n.values[f.id]??f.default??(f.options?f.options[0][0]:"");const connectedCheckbox=f.type==="checkbox"&&links.some(l=>l.kind==="data"&&l.to===n.id&&l.toPin===f.id);if(connectedCheckbox)html+='<label>'+esc(f.label)+'</label><div class="connected-field-value"><span class="connection-indicator"></span><span class="connected-lock">Connected</span></div>';else if(f.type==="select")html+='<label>'+esc(f.label)+'</label><select data-inspect="'+f.id+'">'+f.options.map(o=>'<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?"selected":"")+'>'+esc(o[1])+'</option>').join("")+'</select>';else if(f.type==="variable")html+='<label>'+esc(f.label)+'</label><select data-inspect="'+f.id+'"><option value="">Choose variable…</option>'+variables.map(v=>'<option value="'+v.id+'" '+(v.id===val?"selected":"")+'>'+esc(v.name)+' · '+esc(v.type)+'</option>').join("")+'</select>';else if(n.type==="literal"&&f.id==="value"&&literalIsList(n))html+=literalListEditor(n,true);else if(n.type==="literal"&&f.id==="value"&&(n.values.type||"int")==="bool")html+='<label class="node-field checkbox-field"><span>Value</span><input data-inspect="value" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';else if(f.type==="checkbox")html+='<label class="node-field checkbox-field"><span>'+esc(f.label)+'</span><input data-inspect="'+f.id+'" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';else{const literalType=n.type==="literal"&&f.id==="value"?(n.values.type||"int"):null;const inputType=["int","float","double","long"].includes(literalType)?"number":"text";const step=literalType==="int"||literalType==="long"?"1":literalType==="float"||literalType==="double"?"any":"";html+='<label>'+esc(f.label)+'</label><input data-inspect="'+f.id+'" type="'+inputType+'" '+(step?'step="'+step+'"':"")+' value="'+esc(val)+'">';}});
 if(String(n.type).startsWith("customblock_"))html+='<button type="button" id="renameCustomNode" style="width:100%;margin:10px 0">Rename Custom Node</button>';
 if(n.type==="custominput"||n.type==="customoutput"){
  const ports=n.values.ports||(n.values.ports=[]),isInput=n.type==="custominput";
  html+='<div class="inspector-section"><strong>'+(isInput?'Named inputs':'Named outputs')+'</strong><p class="subtle">'+(isInput?'These pins appear on every instance of this custom node. Unconnected inputs use their default value.':'These pins expose values produced inside this custom node.')+'</p></div>';
  html+=ports.map(p=>'<div class="custom-port-editor"><input data-port-field="name" data-port-id="'+esc(p.id)+'" aria-label="Pin name" value="'+esc(p.name)+'" placeholder="Pin name"><select data-port-field="type" data-port-id="'+esc(p.id)+'" aria-label="Pin type">'+customPortTypes().map(t=>'<option value="'+esc(t)+'" '+(t===p.type?'selected':'')+'>'+esc(t)+'</option>').join("")+'</select>'+(isInput?'<input data-port-field="default" data-port-id="'+esc(p.id)+'" aria-label="Default value" value="'+esc(p.default??customPortDefault(p.type||"float"))+'" placeholder="Default value">':'')+'<button type="button" data-port-remove="'+esc(p.id)+'" aria-label="Remove pin">×</button></div>').join("");
  html+='<button type="button" id="addCustomPort" class="primary" style="width:100%;margin-top:9px">＋ Add named '+(isInput?'input':'output')+'</button>';
 }
 if(n.type==="setcomponent"){
  const ct=connectedComponentType(n);
  html+='<div class="inspector-section"><strong>Component properties</strong></div>';
  if(ct){(componentProperties[ct]||[]).forEach(([id,label])=>{const checked=n.values["use_"+id]==="true";html+='<label class="node-field checkbox-field component-toggle"><span>'+esc(label)+'</span><input data-inspect="use_'+id+'" type="checkbox" '+(checked?"checked":"")+'></label>';});}
  else html+='<p class="subtle">Connect a component or choose a component variable to show its supported properties.</p>';
 }
 if(n.type==="custominput"||n.type==="customoutput")html+='<p class="subtle">This boundary node is fixed and cannot be deleted.</p>';else html+='<div style="margin-top:15px"><button id="deleteNode" style="width:100%">Delete node</button></div>';
 $("nodeInspector").innerHTML=html;
 $("nodeInspector").querySelectorAll("[data-port-field]").forEach(el=>el.addEventListener("change",()=>{
  const port=(n.values.ports||[]).find(p=>p.id===el.dataset.portId);if(!port)return;
  const field=el.dataset.portField;port[field]=el.value;
  if(field==="type"&&n.type==="custominput")port.default=customPortDefault(port.type);
  renderAll();
 }));
 $("nodeInspector").querySelectorAll("[data-port-remove]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.portRemove;n.values.ports=(n.values.ports||[]).filter(p=>p.id!==id);
  links=links.filter(l=>!(l.kind==="data"&&((l.from===n.id&&l.fromPin===id)||(l.to===n.id&&l.toPin===id))));
  renderAll();
 }));
 const addPortButton=$("addCustomPort");
 if(addPortButton)addPortButton.onclick=()=>addCustomPort(n,"float");
 $("nodeInspector").querySelectorAll("[data-inspect]").forEach(el=>el.addEventListener(el.type==="checkbox"?"input":"change",()=>{const field=el.dataset.inspect;n.values[field]=el.type==="checkbox"?String(el.checked):el.value;if(n.type==="literal"&&field==="value"&&n.values.type==="int"&&el.type!=="checkbox"){n.values[field]=String(Math.trunc(Number(el.value)||0));el.value=n.values[field]}const componentField=n.type==="setcomponent"&&field.startsWith("use_");if(["type","variable","componentType","componentVariable","toType","outputType","operandType","vectorType","property"].includes(field)||field.startsWith("use_")||(field==="operation"&&["transform","gameobject"].includes(n.type)))removeIncompatibleLinksForOutput(n.id);removeIncompatibleLinksForInput(n.id);if(componentField){pruneIncompatibleLinks();renderNodes();renderInspector();renderCode()}else renderAll()}));

 const saveListValue=(index,input)=>{const values=literalListValues(n),type=literalListElement(n);values[index]=type==="bool"?(input.checked?"true":"false"):input.value;n.values.value=JSON.stringify(values);renderNodes();renderCode();};
 $("nodeInspector").querySelectorAll("[data-list-item]").forEach(input=>input.addEventListener("change",()=>saveListValue(Number(input.dataset.listItem),input)));
 $("nodeInspector").querySelectorAll("[data-list-add-inspector]").forEach(button=>button.addEventListener("click",()=>{const values=literalListValues(n);values.push(literalListElement(n)==="bool"?"false":BlueprintTypes.defaultValue(literalListElement(n)));n.values.value=JSON.stringify(values);renderAll();}));
 $("nodeInspector").querySelectorAll("[data-list-remove-inspector]").forEach(button=>button.addEventListener("click",()=>{const values=literalListValues(n);values.splice(Number(button.dataset.listRemoveInspector),1);n.values.value=JSON.stringify(values);renderAll();}));
 const renameButton=$("renameCustomNode");if(renameButton)renameButton.onclick=()=>{const def=customBlocks.find(x=>"customblock_"+x.id===n.type);if(!def)return;const name=(prompt("Rename custom node:",def.name)||"").trim();if(!name)return;if(customBlocks.some(x=>x.id!==def.id&&x.name.toLowerCase()===name.toLowerCase())){alert("A custom node with that name already exists.");return}def.name=name;saveCustomBlocks();syncCustomDefs();renderAll();status("Renamed custom node: "+name)};
 const deleteButton=$("deleteNode");if(deleteButton)deleteButton.onclick=()=>{nodes=nodes.filter(x=>x.id!==n.id);links=links.filter(l=>l.from!==n.id&&l.to!==n.id);selectedNode=null;renderAll()};
}
function setView(view){
 activeView=view;
 const isCode=view==="code";
 const main=document.querySelector(".main");
 const workspace=$("workspace");
 const panel=document.querySelector(".code-panel");
 main.classList.toggle("code-mode",isCode);
 workspace.hidden=isCode;
 $("graphTab").classList.toggle("active",!isCode);
 $("csharpTab").classList.toggle("active",isCode);
 panel.classList.toggle("collapsed",false);
 $("codeOutput").hidden=false;
 $("toggleCode").textContent="Hide code";
 codeVisible=true;
 if(isCode)renderCode();
}
function renderCode(){
 const result=BlueprintCompiler.compile(nodes,links,variables,$("projectName").value||"BlueprintScript",customBlocks);
 $("codeOutput").textContent=result.code;
 $("diagnostics").innerHTML=result.diagnostics.length?result.diagnostics.map(x=>'<div class="warning">⚠ '+esc(x)+'</div>').join(""):'<span class="status-good">✓ No basic graph issues detected.</span>';
 $("compileStatus").textContent=result.diagnostics.length?" · "+result.diagnostics.length+" issue(s)":" · Live preview";
}
function pruneIncompatibleLinks(){
 links=links.filter(l=>{
  if(l.kind!=="data")return true;
  const source=getNode(l.from),target=getNode(l.to),td=getDef(target?.type);
  const input=nodeInputs(target).find(p=>p.id===l.toPin);
  return !!source&&!!input&&inputActive(target,input)&&typesCompatible(actualOutputType(source,l.fromPin),expectedInputType(target,input));
 }
 );
}
function renderAll(){if(customEditingId)saveCurrentCustomDefinition();pruneIncompatibleLinks();if(customEditingId)saveCurrentCustomDefinition();renderCategories();renderBlocks();renderVariables();renderNodes();renderInspector();renderCode();drawGraphOverview()}

let canvasPan=null;
$("workspace").addEventListener("pointerdown",e=>{
 if(e.button!==0)return;
 if(e.target.closest(".node,button,input,select,textarea,a,.pin,.blueprint-context-menu,.mini-map"))return;
 const workspace=$("workspace");
 canvasPan={x:e.clientX,y:e.clientY,left:workspace.scrollLeft,top:workspace.scrollTop,pointerId:e.pointerId};
 workspace.classList.add("panning");
 workspace.setPointerCapture?.(e.pointerId);
 e.preventDefault();
});
$("workspace").addEventListener("pointermove",e=>{
 if(!canvasPan||e.pointerId!==canvasPan.pointerId)return;
 const workspace=$("workspace");
 const maxLeft=Math.max(0,workspace.scrollWidth-workspace.clientWidth);
 const maxTop=Math.max(0,workspace.scrollHeight-workspace.clientHeight);
 workspace.scrollLeft=Math.max(0,Math.min(maxLeft,canvasPan.left-(e.clientX-canvasPan.x)));
 workspace.scrollTop=Math.max(0,Math.min(maxTop,canvasPan.top-(e.clientY-canvasPan.y)));
 drawGraphOverview();
});
function stopCanvasPan(e){
 if(!canvasPan||e.pointerId!==canvasPan.pointerId)return;
 canvasPan=null;
 $("workspace").classList.remove("panning");
}
$("workspace").addEventListener("pointerup",stopCanvasPan);
$("workspace").addEventListener("pointercancel",stopCanvasPan);

function drawGraphOverview(){
 const map=$("miniMapCanvas"),ctx=map?.getContext("2d"),workspace=$("workspace"),canvas=$("canvas");
 if(!map||!ctx||!workspace||!canvas)return;
 const w=map.width,h=map.height,cw=Math.max(canvas.scrollWidth,canvas.clientWidth,27000),ch=Math.max(canvas.scrollHeight,canvas.clientHeight,27000);
 ctx.clearRect(0,0,w,h);
 ctx.fillStyle="#0a101b";ctx.fillRect(0,0,w,h);
 ctx.strokeStyle="#202d43";ctx.lineWidth=1;
 for(let x=0;x<w;x+=19){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}
 for(let y=0;y<h;y+=19){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 const sx=w/cw,sy=h/ch;
 const center=n=>({x:(n.x+129)*sx,y:(n.y+35)*sy});
 links.forEach(l=>{
  const a=getNode(l.from),b=getNode(l.to);if(!a||!b)return;
  const p=center(a),q=center(b);
  ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);
  ctx.strokeStyle=l.kind==="flow"?"#8d9bb8":"#718fe0";ctx.lineWidth=1.2;ctx.stroke();
 });
 nodes.forEach(n=>{
  ctx.fillStyle=n.color||getDef(n.type)?.color||"#8fa6e8";
  ctx.globalAlpha=.9;
  ctx.fillRect(n.x*sx,n.y*sy,Math.max(3,258*sx),Math.max(2,Math.min(15,42)*sy));
  ctx.globalAlpha=1;
 });
 const vx=workspace.scrollLeft*sx,vy=workspace.scrollTop*sy,vw=workspace.clientWidth*sx,vh=workspace.clientHeight*sy;
 ctx.fillStyle="#91aaff20";ctx.fillRect(vx,vy,vw,vh);
 ctx.strokeStyle="#dce5ff";ctx.lineWidth=1.6;ctx.strokeRect(vx,vy,Math.max(2,vw),Math.max(2,vh));
}
function moveCameraFromOverview(e){
 const map=$("miniMapCanvas"),workspace=$("workspace"),canvas=$("canvas");
 const r=map.getBoundingClientRect(),px=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),py=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
 workspace.scrollLeft=Math.max(0,Math.min(workspace.scrollWidth-workspace.clientWidth,px*canvas.scrollWidth-workspace.clientWidth/2));
 workspace.scrollTop=Math.max(0,Math.min(workspace.scrollHeight-workspace.clientHeight,py*canvas.scrollHeight-workspace.clientHeight/2));
 drawWires();drawGraphOverview();
}
let overviewDragging=false;
$("miniMapCanvas").addEventListener("pointerdown",e=>{overviewDragging=true;$("miniMapCanvas").setPointerCapture?.(e.pointerId);moveCameraFromOverview(e);e.preventDefault();e.stopPropagation()});
$("miniMapCanvas").addEventListener("pointermove",e=>{if(!overviewDragging)return;moveCameraFromOverview(e);e.preventDefault()});
function stopOverviewDrag(){overviewDragging=false}
$("miniMapCanvas").addEventListener("pointerup",stopOverviewDrag);
$("miniMapCanvas").addEventListener("pointercancel",stopOverviewDrag);
$("miniMapToggle").addEventListener("click",()=>{
 const box=$("miniMap"),min=box.classList.toggle("minimized");
 $("miniMapToggle").textContent=min?"+":"−";
 $("miniMapToggle").setAttribute("aria-label",min?"Show mini-map":"Hide mini-map");
});

function snapshot(){return {projectName:$("projectName").value,nodes,links,variables,nextNode,nextVariable,customBlocks:JSON.parse(JSON.stringify(customBlocks))}}
function loadState(s){if(!s||!Array.isArray(s.nodes))throw new Error("This JSON is not a Blueprint project.");if(Array.isArray(s.customBlocks))mergeCustomBlocks(s.customBlocks,true);variables=s.variables||[];nodes=s.nodes.map(n=>{const d=getDef(n.type),defaults={};(d?.fields||[]).forEach(f=>defaults[f.id]=f.default??(f.options?f.options[0][0]:""));return {...n,values:{...defaults,...(n.values||{})}}});links=s.links||[];nextNode=s.nextNode||Math.max(0,...nodes.map(n=>Number(n.id)||0))+1;nextVariable=s.nextVariable||variables.length+1;$("projectName").value=s.projectName||"My Blueprint Project";selectedNode=nodes[0]?.id??null;renderAll()}

const templates=[
 {id:"rotate",name:"Rotating Cube",description:"Rotate the object smoothly around its Y axis.",build(){
  const speed=addVariable({name:"RotationSpeed",type:"float",access:"private-inspector",initial:"45f"});
  const ev=addNode("update",70,90),action=addNode("transform",360,90,{operation:"rotate"}),v=addNode("vector",70,300,{vectorType:"Vector3",x:"0",y:"0",z:"0",w:"0"}),getSpeed=addNode("getvar",70,480,{variable:speed.id});
  links.push({from:ev.id,fromPin:"Then",to:action.id,toPin:"Exec",kind:"flow"},{from:v.id,fromPin:"value",to:action.id,toPin:"vector",kind:"data"},{from:getSpeed.id,fromPin:"value",to:v.id,toPin:"y",kind:"data"});
 }},
 {id:"float",name:"Floating Item",description:"Starter graph with adjustable height and speed variables.",build(){
  addVariable({name:"FloatHeight",type:"float",access:"private-inspector",initial:"0.5f"});
  addVariable({name:"FloatSpeed",type:"float",access:"private-inspector",initial:"2f"});
  const ev=addNode("update",70,90),action=addNode("transform",360,90,{operation:"translate"}),v=addNode("vector",70,300,{vectorType:"Vector3",x:"0",y:"0.01",z:"0",w:"0"});
  links.push({from:ev.id,fromPin:"Then",to:action.id,toPin:"Exec",kind:"flow"},{from:v.id,fromPin:"value",to:action.id,toPin:"vector",kind:"data"});
 }},
 {id:"fade",name:"Fade Object",description:"Starter graph with fade speed and a Renderer reference.",build(){
  addVariable({name:"FadeSpeed",type:"float",access:"private-inspector",initial:"1f"});
  addVariable({name:"TargetRenderer",type:"Renderer",access:"private-inspector",initial:""});
  const ev=addNode("update",70,90),log=addNode("debug",360,90,{message:"Fade starter: alpha fading is not yet supported by the node compiler."});
  links.push({from:ev.id,fromPin:"Then",to:log.id,toPin:"Exec",kind:"flow"});
 }},
 {id:"teleport",name:"Teleport on Spawn",description:"Starter graph with On Start and a destination reference.",build(){
  addVariable({name:"TeleportTarget",type:"Transform",access:"private-inspector",initial:""});
  const ev=addNode("start",70,90),action=addNode("transform",360,90,{operation:"setPosition"}),v=addNode("vector",70,300,{vectorType:"Vector3",x:"0",y:"0",z:"0",w:"0"});
  links.push({from:ev.id,fromPin:"Then",to:action.id,toPin:"Exec",kind:"flow"},{from:v.id,fromPin:"value",to:action.id,toPin:"vector",kind:"data"});
 }}
];
function openTemplates(){
 $("modalTitle").textContent="Load a template";
 $("modalConfirm").textContent="Cancel";
 $("modalBody").innerHTML='<div class="subtle">Loading a template replaces the current graph and variables.</div><div class="template-list">'+templates.map(t=>'<button type="button" class="template-choice" data-template="'+t.id+'"><strong>'+esc(t.name)+'</strong><span>'+esc(t.description)+'</span></button>').join("")+'</div>';
 $("modal").hidden=false;
 $("modalConfirm").onclick=()=>{$("modal").hidden=true};
 $("modalBody").querySelectorAll("[data-template]").forEach(button=>button.onclick=()=>{
  const template=templates.find(t=>t.id===button.dataset.template);
  if(!template)return;
  nodes=[];links=[];variables=[];nextNode=1;nextVariable=1;
  template.build();
  selectedNode=nodes[0]?.id??null;
  $("projectName").value=template.name;
  $("modal").hidden=true;
  renderAll();
  status(template.name+" template loaded");
 });
}

function example(){
 nodes=[];links=[];variables=[];nextNode=1;nextVariable=1;
 const speed=addVariable({name:"MoveSpeed",type:"float",access:"private-inspector",initial:"5f"});
 const start=addNode("start",80,90),set=addNode("debug",360,90,{message:"Blueprint Studio is connected!"}),math=addNode("math",370,330,{operation:"multiply"}),a=addNode("literal",80,380,{type:"float",value:"2"}),b=addNode("literal",80,560,{type:"float",value:"3"});
 links.push({from:start.id,fromPin:"Then",to:set.id,toPin:"Exec",kind:"flow"},{from:a.id,fromPin:"value",to:math.id,toPin:"a",kind:"data"},{from:b.id,fromPin:"value",to:math.id,toPin:"b",kind:"data"});
 status("Starter example loaded");renderAll();
}
$("graphTab").onclick=e=>{e.preventDefault();setView("graph")};
$("csharpTab").onclick=e=>{e.preventDefault();setView("code")};
$("blockSearch").addEventListener("input",renderBlocks);
$("addVariable").onclick=$("addVariableSide").onclick=()=>openVariableModal();
$("toggleVariables").onclick=()=>{$("variablesPanel").hidden=!$("variablesPanel").hidden};
$("closeVariables").onclick=()=>{$("variablesPanel").hidden=true};
$("modalClose").onclick=$("modalCancel").onclick=()=>{$("modal").hidden=true};$("exitCustomEditor").onclick=exitCustomEditor;
$("starterExample").onclick=example;
 $("loadTemplate").onclick=openTemplates;
$("newProject").onclick=()=>{if(confirm("Create a new project? Unsaved changes in the current graph will be replaced.")){nodes=[];links=[];variables=[];nextNode=1;nextVariable=1;selectedNode=null;$("projectName").value="My Blueprint Project";renderAll();status("New project")}};
let currentLibraryId=null;const LIBRARY_KEY="ikirumi-unity-blueprint-library-v1";
function libraryEntries(){try{const a=JSON.parse(localStorage.getItem(LIBRARY_KEY)||"[]");return Array.isArray(a)?a:[]}catch{return []}}
function writeLibrary(a){localStorage.setItem(LIBRARY_KEY,JSON.stringify(a))}
function entrySize(e){return new Blob([JSON.stringify(e.project)]).size}
function formatSize(n){return n<1024?n+" B":n<1048576?(n/1024).toFixed(1)+" KB":(n/1048576).toFixed(2)+" MB"}
function makeEntry(project,name,old=null){const now=new Date().toISOString();return{id:old?.id||"script-"+Date.now()+"-"+Math.random().toString(36).slice(2,8),name:String(name||project.projectName||"Untitled script"),folder:old?.folder||"My Scripts",favorite:old?.favorite||false,createdAt:old?.createdAt||now,updatedAt:now,project}}
function saveCurrentToLibrary(forceNew=false,name=null){const project=JSON.parse(JSON.stringify(snapshot())),all=libraryEntries();let old=!forceNew&&currentLibraryId?all.find(e=>e.id===currentLibraryId):null;if(!old&&!forceNew)old=all.find(e=>e.name===project.projectName);const entry=makeEntry(project,name||old?.name||project.projectName,old);if(old)all[all.findIndex(e=>e.id===old.id)]=entry;else all.unshift(entry);currentLibraryId=entry.id;writeLibrary(all);renderLibrary();return entry}
function openLibrary(){renderLibrary();$("libraryPanel").hidden=false}
function renderLibrary(){const list=$("libraryList"),q=($("librarySearch").value||"").trim().toLowerCase(),all=libraryEntries(),visible=all.filter(e=>(e.name+" "+(e.folder||"")+(e.favorite?" favorite":"")).toLowerCase().includes(q));$("libraryCount").textContent=all.length+" script"+(all.length===1?"":"s");list.innerHTML=visible.length?visible.map(e=>'<article class="library-entry"><div class="library-entry-top"><button class="library-load" data-action="load" data-id="'+esc(e.id)+'"><strong>'+esc(e.name)+'</strong><span>'+esc(e.folder||"My Scripts")+(e.favorite?" · ★ Favorite":"")+'</span></button><button class="library-favorite '+(e.favorite?"active":"")+'" data-action="favorite" data-id="'+esc(e.id)+'">'+(e.favorite?"★":"☆")+'</button></div><div class="library-meta"><span>Size <b>'+formatSize(entrySize(e))+'</b></span><span>Made '+esc(new Date(e.createdAt).toLocaleString())+'</span><span>Updated '+esc(new Date(e.updatedAt).toLocaleString())+'</span></div><div class="library-entry-actions"><button data-action="rename" data-id="'+esc(e.id)+'">Rename</button><button data-action="move" data-id="'+esc(e.id)+'">Move</button><button data-action="export" data-id="'+esc(e.id)+'">Export JSON</button><button data-action="publish" data-id="'+esc(e.id)+'">Publish</button><button class="danger" data-action="delete" data-id="'+esc(e.id)+'">Remove</button></div></article>').join(""):'<div class="library-empty">No saved scripts yet. Press Save or add a JSON file.</div>'}

function exploreEndpoint(){let saved=(localStorage.getItem(EXPLORE_ENDPOINT_KEY)||"").trim();const previous=["https://script.google.com/macros/s/AKfycbxBd0xGmrI3A78LASgrNKXy2mzNF8X5y4CIYS8z8-qFj_Pd7Yymdr45D0l-tiv5Qk8W/exec"];if(!saved||previous.includes(saved)){saved=EXPLORE_DEFAULT_ENDPOINT;try{localStorage.setItem(EXPLORE_ENDPOINT_KEY,saved)}catch{}}return saved}
let exploreItems=[],activeExploreTab="codes";
function saveExploreEndpoint(){const value=$("exploreEndpoint").value.trim();if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec(?:\?.*)?$/.test(value)){alert("Paste a deployed Google Apps Script web app URL ending in /exec.");return}localStorage.setItem(EXPLORE_ENDPOINT_KEY,value);$("exploreConnectionStatus").textContent="URL saved. Loading published items…";refreshExplore()}
function openExplore(){ $("libraryPanel").hidden=true;$("explorePanel").hidden=false;$("exploreEndpoint").value=exploreEndpoint();renderExplore();refreshExplore()}
function setExploreTab(tab){activeExploreTab=tab;const custom=tab==="custom";$("exploreCodesView").hidden=custom;$("exploreCustomView").hidden=!custom;$("exploreCodesTab").classList.toggle("active",!custom);$("exploreCustomTab").classList.toggle("active",custom);renderExplore()}
function jsonpRequest(url,params={}){return new Promise((resolve,reject)=>{const cb="cstudioExploreCallback_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),script=document.createElement("script"),timer=setTimeout(()=>{cleanup();reject(Error("Timed out contacting Explore."))},18000);function cleanup(){clearTimeout(timer);delete window[cb];script.remove()}window[cb]=data=>{cleanup();resolve(data)};script.onerror=()=>{cleanup();reject(Error("Could not reach the Apps Script endpoint. Check deployment access and URL."))};const query=new URLSearchParams({...params,callback:cb});script.src=url+(url.includes("?")?"&":"?")+query.toString();document.body.appendChild(script)})}
function jsonpList(url){return jsonpRequest(url,{action:"list"})}
async function refreshExplore(){const endpoint=exploreEndpoint();$("exploreConnectionStatus").textContent="Loading published items…";try{const data=await jsonpList(endpoint);if(!data||data.ok===false)throw Error(data?.error||"Explore returned an error.");exploreItems=Array.isArray(data.items)?data.items:[];$("exploreConnectionStatus").textContent="Connected · "+exploreItems.length+" published item"+(exploreItems.length===1?"":"s");renderExplore()}catch(e){$("exploreConnectionStatus").textContent=e.message+" If this is a new deployment, check that access is set to anyone with the link."}}
function renderExplore(){const q1=($("exploreCodesSearch")?.value||"").trim().toLowerCase(),q2=($("exploreCustomSearch")?.value||"").trim().toLowerCase(),codes=exploreItems.filter(x=>x.type==="code"&&(String(x.name||"")).toLowerCase().includes(q1)),blocks=exploreItems.filter(x=>x.type==="custom"&&(String(x.name||"")).toLowerCase().includes(q2));$("exploreCodesCount").textContent=codes.length+" published code"+(codes.length===1?"":"s");$("exploreCustomCount").textContent=blocks.length+" published custom block"+(blocks.length===1?"":"s");const card=x=>'<article class="library-entry"><div class="library-entry-top"><div class="server-entry-title"><strong>'+esc(x.name||"Untitled")+'</strong></div><span class="server-badge">'+(x.type==="custom"?"CUSTOM BLOCK":"CODE")+'</span></div><div class="library-meta"><span>Published '+esc(x.createdAt?new Date(x.createdAt).toLocaleDateString():"date unknown")+'</span></div><div class="library-entry-actions"><button class="primary" data-explore-action="install" data-id="'+esc(x.id)+'">Install</button><button data-explore-action="edit" data-id="'+esc(x.id)+'">Edit</button></div></article>';$("exploreCodesList").innerHTML=codes.length?codes.map(card).join(""):'<div class="library-empty">No published codes found.</div>';$("exploreCustomList").innerHTML=blocks.length?blocks.map(card).join(""):'<div class="library-empty">No published custom blocks found.</div>'}
function closeExploreMenus(){["libraryPanel","explorePanel"].forEach(id=>{const el=$(id);if(el)el.hidden=true});}
function showExploreProgress(title,detail,percent){const panel=$("loadProgress");panel.hidden=false;$("loadProgressTitle").textContent=title;$("loadProgressDetail").textContent=detail;$("loadProgressBar").style.width=Math.max(0,Math.min(100,percent))+"%";$("loadProgressStages").textContent="";$("loadProgressPercent").textContent=Math.max(0,Math.min(100,percent))+"%";}
function finishExploreProgress(){const panel=$("loadProgress");panel.hidden=true;closeExploreMenus();$("modal").hidden=true;}
function openExploreModal(title,body,confirmText="Save",validate=null){
 closeExploreMenus();
 return new Promise(resolve=>{
  const modal=$("modal"),confirmButton=$("modalConfirm"),cancelButton=$("modalCancel"),closeButton=$("modalClose");
  $("modalTitle").textContent=title;$("modalBody").innerHTML=body;confirmButton.textContent=confirmText;confirmButton.hidden=false;confirmButton.disabled=false;cancelButton.textContent="Cancel";modal.hidden=false;
  let finished=false;const finish=value=>{if(finished)return;finished=true;modal.hidden=true;confirmButton.onclick=null;cancelButton.onclick=null;closeButton.onclick=null;resolve(value)};
  confirmButton.onclick=()=>{if(validate){const value=validate();if(value===false)return;finish(value)}else finish({confirmed:true})};
  cancelButton.onclick=()=>finish(null);closeButton.onclick=()=>finish(null);
  const first=$("exploreModalFirstInput");if(first)first.focus();
 });
}
async function publishItem(type,item){
 closeExploreMenus();
 const endpoint=exploreEndpoint();
 const kind=type==="code"?"code":"custom",label=kind==="code"?"code":"custom block";
 const name=String(item.name||"Untitled").trim().slice(0,120);
 if(!endpoint){const message="Publish failed: no Google Apps Script backend URL is configured.";status(message);alert(message);return}
 const previousIds=new Set(exploreItems.map(x=>String(x.id))),serializedPayload=JSON.stringify(item.payload),maxPayloadChars=225000;
 if(serializedPayload.length>maxPayloadChars){const message="Publish failed: this item contains "+serializedPayload.length.toLocaleString()+" characters of data, but the five Google Sheets payload cells support up to "+maxPayloadChars.toLocaleString()+". Reduce the project size and try again.";status(message);alert(message);return}
 showExploreProgress("Publishing "+label,"Step 1/3 · Preparing project data…",10);status("Publishing "+label+"…");
 try{
  showExploreProgress("Publishing "+label,"Step 2/3 · Sending the project to Google Sheets…",25);
  await fetch(endpoint,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"publish",type:kind,name,payload:item.payload})});
  let lastError=null,published=null;
  for(let attempt=1;attempt<=10;attempt++){
   showExploreProgress("Publishing "+label,"Step 3/3 · Checking Google Sheets… attempt "+attempt+" of 10.",25+attempt*7);
   await new Promise(resolve=>setTimeout(resolve,1000));
   try{
    const data=await jsonpList(endpoint);
    if(!data||data.ok===false)throw Error(data?.error||"Google Apps Script returned an error.");
    const items=Array.isArray(data.items)?data.items:[];
    published=items.find(x=>!previousIds.has(String(x.id))&&x.type===kind&&String(x.name||"").trim()===name&&JSON.stringify(x.payload)===serializedPayload)||null;
    exploreItems=items;
    if(published)break;
   }catch(e){lastError=e}
  }
  if(published){
   renderExplore();
   status("Publish successful: "+name+" · confirmed in Google Sheets.");
  }else{
   const message="Publish failed: Google Sheets did not confirm the new item."+(lastError?" Last check error: "+lastError.message+". ":"")+"Check the Apps Script deployment URL, access permissions, and execution log.";
   status(message);alert(message);
  }
 }catch(e){
  const message="Publish failed: "+(e?.message||String(e))+". Check your internet connection and the Google Apps Script deployment.";
  status(message);alert(message);
 }finally{finishExploreProgress()}
}
async function sendExploreManage(id,manageAction,extra={}){
 const endpoint=exploreEndpoint();
 const data=await jsonpRequest(endpoint,{action:"manage",id,manageAction,...extra});
 if(!data||data.ok!==true)throw Error(data?.error||"Google Apps Script did not confirm the change.");
 const listed=await jsonpList(endpoint);
 if(!listed||listed.ok===false)throw Error(listed?.error||"The change was accepted, but Explore could not refresh.");
 exploreItems=Array.isArray(listed.items)?listed.items:[];
 const current=exploreItems.find(x=>String(x.id)===String(id));
 if(manageAction==="rename"&&current&&current.name===extra.name)return {ok:true};
 if(manageAction==="delete"&&!current)return {ok:true};
 throw Error("Google Sheets confirmed the request, but the listing did not update. Refresh Explore and check the Apps Script execution log.");
}
async function manageExploreItem(id){
 const item=exploreItems.find(x=>String(x.id)===String(id));if(!item)return;
 closeExploreMenus();
 const body='<p class="subtle">Anyone can rename or remove this public listing. People who already installed it keep their local copy; removing it blocks new installs.</p><div class="form-row"><label for="exploreRenamePublic">Public name</label><input id="exploreRenamePublic" maxlength="120" value="'+esc(item.name)+'"></div><div class="form-row"><button id="exploreRenameAction" type="button">Rename listing</button></div><div class="form-row"><button id="exploreRemoveAction" class="danger" type="button">Remove from Explore</button></div>';
 $("modalTitle").textContent="Edit published item";$("modalBody").innerHTML=body;$("modalConfirm").hidden=true;$("modalCancel").textContent="Close";$("modal").hidden=false;
 const close=()=>{$("modal").hidden=true;$("modalConfirm").hidden=false;$("modalCancel").textContent="Cancel"};
 $("modalCancel").onclick=close;$("modalClose").onclick=close;
 const run=async(action,extra={})=>{
  closeExploreMenus();showExploreProgress(action==="rename"?"Renaming listing":"Removing listing","Sending the change and waiting for Google Sheets…",30);status(action==="rename"?"Renaming public listing…":"Removing public listing…");
  try{
   await sendExploreManage(item.id,action,extra);
   renderExplore();status(action==="rename"?"Public listing renamed.":"Removed from Explore. Existing installed copies remain.");
  }catch(e){const message="Could not "+(action==="rename"?"rename":"remove")+" listing: "+(e?.message||String(e));status(message);alert(message)}
  finally{finishExploreProgress()}
 };
 $("exploreRenameAction").onclick=()=>{const name=$("exploreRenamePublic").value.trim();if(!name||name===item.name){alert("Enter a different public name.");return}run("rename",{name})};
 $("exploreRemoveAction").onclick=()=>{if(confirm("Remove this listing from Explore? Anyone who already installed it keeps their local copy, but new installs will no longer be possible."))run("delete")};
}
function installExploreItem(id){const item=exploreItems.find(x=>String(x.id)===String(id));if(!item)return;let payload=item.payload;try{if(typeof payload==="string")payload=JSON.parse(payload)}catch{alert("This published item has invalid data.");return}if(item.type==="code"){const project=payload?.project||payload;if(!project||!Array.isArray(project.nodes)){alert("This published code has invalid project data.");return}const all=libraryEntries();if(all.some(e=>e.publishedSourceId===item.id)){status("Already installed in Library > Codes.");return}const entry=makeEntry(project,item.name||project.projectName||"Installed code");entry.publishedSourceId=item.id;entry.folder="Explore installs";all.unshift(entry);writeLibrary(all);renderLibrary();status("Installed locally. Open Library > Codes to rename or load it.");return}const incoming=Array.isArray(payload?.customBlocks)?payload.customBlocks:(payload?.customBlock?[payload.customBlock]:[payload]);if(!incoming.length||!incoming[0]?.nodes){alert("This published custom block has invalid data.");return}if(customBlocks.some(b=>b.publishedSourceId===item.id)){status("Already installed in Library > Custom Blocks.");return}const idMap=new Map(incoming.map(b=>[String(b.id),"installed_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7)+"_"+String(b.id).replace(/[^a-z0-9]/gi,"").slice(-6)]));const cloned=incoming.map((b,i)=>{const c=JSON.parse(JSON.stringify(b));c.id=idMap.get(String(b.id));c.publishedSourceId=i===0?item.id:undefined;if(i===0)c.name=item.name||b.name;c.nodes=(c.nodes||[]).map(n=>{if(String(n.type).startsWith("customblock_")){const old=n.type.slice("customblock_".length);if(idMap.has(old))n.type="customblock_"+idMap.get(old)}return n});return c});customBlocks.push(...cloned);saveCustomBlocks();syncCustomDefs();renderCustomBlockLibrary();status("Installed locally. Open Library > Custom Blocks to edit or rename your copy.")}
$("openExplore").onclick=openExplore;$("closeExplore").onclick=()=>$("explorePanel").hidden=true;$("saveExploreEndpoint").onclick=saveExploreEndpoint;$("exploreCodesTab").onclick=()=>setExploreTab("codes");$("exploreCustomTab").onclick=()=>setExploreTab("custom");$("refreshExploreCodes").onclick=refreshExplore;$("refreshExploreCustom").onclick=refreshExplore;$("exploreCodesSearch").addEventListener("input",renderExplore);$("exploreCustomSearch").addEventListener("input",renderExplore);["exploreCodesList","exploreCustomList"].forEach(listId=>$(listId).addEventListener("click",e=>{const b=e.target.closest("[data-explore-action]");if(!b)return;if(b.dataset.exploreAction==="install")installExploreItem(b.dataset.id);if(b.dataset.exploreAction==="edit")manageExploreItem(b.dataset.id)}));$("exploreEndpoint").value=exploreEndpoint();

function openLibrary(){renderLibrary();renderCustomBlockLibrary();$("libraryPanel").hidden=false;setLibraryTab("scripts")}
function setLibraryTab(tab){const custom=tab==="custom";$("libraryLocalView").hidden=custom;$("libraryCustomView").hidden=!custom;$("libraryScriptsTab").classList.toggle("active",!custom);$("libraryCustomTab").classList.toggle("active",custom);$("libraryHeadingTitle").textContent=custom?"CUSTOM BLOCK LIBRARY":"SCRIPT LIBRARY";$("libraryHeadingDescription").textContent=custom?"Rename or remove reusable custom node definitions. Changes apply to every instance.":"Scripts saved on this device only."}
function renderCustomBlockLibrary(){const list=$("customBlockLibraryList"),q=($("customBlockSearch").value||"").trim().toLowerCase(),all=[...customBlocks].sort((a,b)=>a.name.localeCompare(b.name)),visible=all.filter(b=>(b.name+" "+(b.description||"")).toLowerCase().includes(q));$("customBlockCount").textContent=all.length+" custom block"+(all.length===1?"":"s");list.innerHTML=visible.length?visible.map(b=>{const instanceCount=nodes.filter(n=>n.type==="customblock_"+b.id).length;const pinCount=(b.nodes||[]).reduce((sum,n)=>sum+(n.values?.ports||[]).length,0);return '<article class="library-entry"><div class="library-entry-top"><div class="server-entry-title"><strong>'+esc(b.name)+'</strong><span>Reusable node · '+pinCount+' input/output pins · '+instanceCount+' on current canvas</span></div><span class="server-badge">CUSTOM</span></div><div class="library-meta"><span>Internal nodes <b>'+((b.nodes||[]).length)+'</b></span><span>Private variables <b>'+((b.variables||[]).length)+'</b></span></div><div class="library-entry-actions"><button data-custom-action="edit" data-id="'+esc(b.id)+'">Open / Edit</button><button data-custom-action="publish" data-id="'+esc(b.id)+'">Publish</button><button data-custom-action="rename" data-id="'+esc(b.id)+'">Rename</button><button class="danger" data-custom-action="delete" data-id="'+esc(b.id)+'">Remove</button></div></article>'}).join(""):'<div class="library-empty">'+(all.length?"No custom blocks match your search.":"No custom blocks yet. Create one from the Custom Nodes category.")+'</div>'}
function renameCustomBlock(id){const block=customBlocks.find(b=>b.id===id);if(!block)return;const name=(prompt("Rename custom block:",block.name)||"").trim();if(!name||name===block.name)return;if(customBlocks.some(b=>b.id!==id&&b.name.toLowerCase()===name.toLowerCase())){alert("A custom block with that name already exists.");return}block.name=name;saveCustomBlocks();syncCustomDefs();renderAll();renderCustomBlockLibrary();status("Renamed custom block: "+name)}
function removeCustomBlock(id){const block=customBlocks.find(b=>b.id===id);if(!block)return;if(!confirm('Remove custom block "'+block.name+'"? Its placed instances and references inside other custom blocks will also be removed.'))return;const type="customblock_"+id,removedNodeIds=new Set(nodes.filter(n=>n.type===type).map(n=>n.id));nodes=nodes.filter(n=>n.type!==type);links=links.filter(l=>!removedNodeIds.has(l.from)&&!removedNodeIds.has(l.to));customBlocks=customBlocks.filter(b=>b.id!==id);customBlocks.forEach(b=>{const removed=new Set((b.nodes||[]).filter(n=>n.type===type).map(n=>n.id));b.nodes=(b.nodes||[]).filter(n=>n.type!==type);b.links=(b.links||[]).filter(l=>!removed.has(l.from)&&!removed.has(l.to))});saveCustomBlocks();syncCustomDefs();selectedNode=nodes.some(n=>n.id===selectedNode)?selectedNode:(nodes[0]?.id??null);renderAll();renderCustomBlockLibrary();renderLibrary();status("Removed custom block: "+block.name)}
async function loadProjectWithProgress(p,id=null){if(!p||!Array.isArray(p.nodes))throw Error("This JSON is not a Blueprint project.");if(Array.isArray(p.customBlocks))mergeCustomBlocks(p.customBlocks);const vs=Array.isArray(p.variables)?p.variables:[],ns=p.nodes,ls=Array.isArray(p.links)?p.links:[],total=vs.length+ns.length+ls.length+1,panel=$("loadProgress"),c={v:0,n:0,l:0,i:0,it:ns.reduce((a,n)=>a+Object.values(n.values||{}).filter(v=>v!==""&&v!==null&&v!==undefined).length,0)};let done=0;panel.hidden=false;$("loadProgressTitle").textContent="Loading "+(p.projectName||"Blueprint script");const update=t=>{$("loadProgressDetail").textContent=t;$("loadProgressBar").style.width=Math.min(100,Math.round(done/Math.max(1,total)*100))+"%";$("loadProgressPercent").textContent=Math.min(100,Math.round(done/Math.max(1,total)*100))+"%";$("loadProgressStages").innerHTML='<div>Variables added <b>'+c.v+' / '+vs.length+'</b></div><div>Nodes spawned <b>'+c.n+' / '+ns.length+'</b></div><div>Connections added <b>'+c.l+' / '+ls.length+'</b></div><div>Manual inputs set <b>'+c.i+' / '+c.it+'</b></div>'},pause=()=>new Promise(r=>setTimeout(r,Math.min(12,Math.max(1,150/Math.max(1,total)))));try{variables=[];nodes=[];links=[];nextNode=1;nextVariable=1;selectedNode=null;$("projectName").value=p.projectName||"My Blueprint Project";renderAll();update("Preparing project…");await pause();for(const v of vs){variables.push(v);c.v++;done++;nextVariable=Math.max(nextVariable,Number(String(v.id).replace(/^v/,""))+1||c.v+1);renderVariables();update("Adding variables…");await pause()}for(const src of ns){const d=getDef(src.type),defaults={};(d?.fields||[]).forEach(f=>defaults[f.id]=f.default??(f.options?f.options[0][0]:""));nodes.push({...src,values:{...defaults,...(src.values||{})}});c.n++;c.i+=Object.values(src.values||{}).filter(v=>v!==""&&v!==null&&v!==undefined).length;done++;nextNode=Math.max(nextNode,Number(src.id)||0)+1;renderNodes();update("Spawning nodes…");await pause()}for(const l of ls){links.push(l);c.l++;done++;drawWires();update("Restoring connections…");await pause()}nextNode=p.nextNode||Math.max(0,...nodes.map(n=>Number(n.id)||0))+1;nextVariable=p.nextVariable||variables.length+1;selectedNode=nodes[0]?.id??null;renderAll();$("workspace").scrollTo({left:0,top:0,behavior:"auto"});$("loadProgressDetail").textContent="All stages complete.";$("loadProgressBar").style.width="100%";$("loadProgressPercent").textContent="100%";await new Promise(r=>setTimeout(r,300));panel.hidden=true;if(id)currentLibraryId=id;status("Loaded "+nodes.length+" nodes")}catch(e){panel.hidden=true;throw e}}
function openSaveChoices(){
 $("modalTitle").textContent="Save Project";
 $("modalBody").innerHTML='<p class="subtle">Where would you like to save this project?</p><div class="save-choice-list"><button type="button" class="save-choice" id="saveForNextTime"><strong>Save for next time</strong><span>Save the current project on this device so it can be loaded again later. Do not add it to the Script Library.</span></button><button type="button" class="save-choice" id="saveToLibrary"><strong>Save to Library</strong><span>Keep a named copy in your Script Library, where you can manage and reopen it.</span></button></div>';
 $("modalConfirm").hidden=true;$("modalCancel").textContent="Cancel";$("modalCancel").onclick=()=>$("modal").hidden=true;$("modal").hidden=false;
 $("saveForNextTime").onclick=()=>{try{BlueprintStorage.save(snapshot());$("modal").hidden=true;status("Saved for next time on this device")}catch(e){alert("Could not save locally: "+e.message)}};
 $("saveToLibrary").onclick=()=>openLibrarySaveChoice();
}
function openLibrarySaveChoice(){
 const all=libraryEntries(),preferred=currentLibraryId||all.find(e=>e.name===($("projectName").value.trim()||"My Blueprint Project"))?.id||all[0]?.id||"";
 $("modalTitle").textContent="Save to Library";
 $("modalBody").innerHTML='<p class="subtle">Choose whether to replace an existing library script or create a separate new entry.</p><div class="form-row"><label for="replaceLibraryScript">Existing script to replace</label><select id="replaceLibraryScript"><option value="">Select an existing script…</option>'+all.map(e=>'<option value="'+esc(e.id)+'" '+(e.id===preferred?'selected':'')+'>'+esc(e.name)+'</option>').join("")+'</select></div><div class="save-choice-list"><button type="button" class="save-choice" id="replaceLibraryEntry" '+(!all.length?'disabled':'')+'><strong>Replace existing script</strong><span>Update the selected library entry with the current project.</span></button><button type="button" class="save-choice" id="createLibraryEntry"><strong>Create new in Library</strong><span>Add the current project as a new library entry without replacing anything.</span></button></div>';
 $("modalConfirm").hidden=true;$("modalCancel").textContent="Back";$("modal").hidden=false;
 $("modalCancel").onclick=()=>openSaveChoices();
 $("replaceLibraryEntry").onclick=()=>{const id=$("replaceLibraryScript").value;if(!id){alert("Select the library script you want to replace.");return}const entries=libraryEntries(),old=entries.find(e=>e.id===id);if(!old)return;if(!confirm('Replace "'+old.name+'" in the Library with the current project?'))return;try{const entry=makeEntry(JSON.parse(JSON.stringify(snapshot())),old.name,old);entries[entries.findIndex(e=>e.id===id)]=entry;currentLibraryId=entry.id;writeLibrary(entries);renderLibrary();$("modal").hidden=true;status("Replaced library script · "+entry.name)}catch(e){alert("Could not update Library: "+e.message)}};
 $("createLibraryEntry").onclick=()=>{const name=prompt("Name the new library script:",$("projectName").value.trim()||"Untitled script");if(name===null)return;try{const entry=saveCurrentToLibrary(true,name.trim()||"Untitled script");$("modal").hidden=true;status("Created library script · "+entry.name)}catch(e){alert("Could not save to Library: "+e.message)}};
}
$("saveProject").onclick=openSaveChoices;
$("loadProject").onclick=()=>{const p=BlueprintStorage.load();if(p)loadProjectWithProgress(p).catch(e=>alert(e.message));else $("fileInput").click()};
$("fileInput").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const p=JSON.parse(await file.text());await loadProjectWithProgress(p);BlueprintStorage.save(snapshot());status("Project JSON imported")}catch(err){alert("Could not import JSON: "+err.message)}e.target.value=""};
$("importJSON").onclick=()=>$("fileInput").click();$("openLibrary").onclick=openLibrary;$("closeLibrary").onclick=()=>$("libraryPanel").hidden=true;$("librarySearch").addEventListener("input",renderLibrary);$("libraryImportJson").onclick=()=>$("libraryJsonInput").click();$("libraryScriptsTab").onclick=()=>setLibraryTab("scripts");$("libraryCustomTab").onclick=()=>{renderCustomBlockLibrary();setLibraryTab("custom")};$("customBlockSearch").addEventListener("input",renderCustomBlockLibrary);$("customBlockLibraryList").addEventListener("click",e=>{const b=e.target.closest("button[data-custom-action]");if(!b)return;const {customAction,id}=Object.assign({customAction:b.dataset.customAction},b.dataset);if(customAction==="rename")renameCustomBlock(id);if(customAction==="delete")removeCustomBlock(id);if(customAction==="publish"){const block=customBlocks.find(x=>x.id===id);if(block)publishItem("custom",{name:block.name,payload:{customBlock:block}})}if(customAction==="edit"){if(!customBlocks.some(x=>x.id===id))return;$("libraryPanel").hidden=true;enterCustomEditor(id)}});
$("librarySaveCurrent").onclick=()=>{const name=prompt("Name this saved script:",$("projectName").value||"Untitled script");if(name===null)return;try{const e=saveCurrentToLibrary(true,name.trim()||"Untitled script");status("Saved "+e.name+" to Library")}catch(e){alert("Could not save to Library: "+e.message)}};
$("libraryJsonInput").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const p=JSON.parse(await file.text());if(!p||!Array.isArray(p.nodes))throw Error("The JSON does not contain a Blueprint project.");const all=libraryEntries();all.unshift(makeEntry(p,file.name.replace(/\.json$/i,"")||p.projectName||"Imported script"));writeLibrary(all);renderLibrary();status("JSON added to Library")}catch(err){alert("Could not add JSON to Library: "+err.message)}e.target.value=""};
$("libraryList").addEventListener("click",async e=>{const b=e.target.closest("button[data-action]");if(!b)return;const {action,id}=b.dataset,all=libraryEntries(),entry=all.find(x=>x.id===id);if(!entry)return;try{if(action==="load"){await loadProjectWithProgress(entry.project,entry.id);$("libraryPanel").hidden=true;return}if(action==="favorite")entry.favorite=!entry.favorite;if(action==="rename"){const n=prompt("Rename saved script:",entry.name);if(n===null)return;entry.name=n.trim()||entry.name;entry.updatedAt=new Date().toISOString()}if(action==="move"){const n=prompt("Move to collection/folder:",entry.folder||"My Scripts");if(n===null)return;entry.folder=n.trim()||"My Scripts";entry.updatedAt=new Date().toISOString()}if(action==="delete"){if(!confirm('Remove "'+entry.name+'" from this device?'))return;writeLibrary(all.filter(x=>x.id!==id));if(currentLibraryId===id)currentLibraryId=null;renderLibrary();return}if(action==="export")BlueprintStorage.download(BlueprintStorage.safeName(entry.name)+".json",BlueprintStorage.snapshot(entry.project),"application/json");if(action==="publish"){publishItem("code",{name:entry.name,payload:{project:entry.project}});return}writeLibrary(all);renderLibrary()}catch(err){alert("Library action failed: "+err.message)}});
$("downloadProject").onclick=()=>BlueprintStorage.download(BlueprintStorage.safeName($("projectName").value)+".json",BlueprintStorage.snapshot(snapshot()),"application/json");
$("exportProject").onclick=()=>BlueprintStorage.download(BlueprintStorage.safeName($("projectName").value)+".cs",$("codeOutput").textContent,"text/plain");
$("copyCode").onclick=async()=>{try{await navigator.clipboard.writeText($("codeOutput").textContent);status("C# copied")}catch(e){const r=document.createRange();r.selectNodeContents($("codeOutput"));const s=getSelection();s.removeAllRanges();s.addRange(r);status("Select and copy the code")}};
$("toggleCode").onclick=()=>{codeVisible=!codeVisible;document.querySelector(".code-panel").classList.toggle("collapsed",!codeVisible);$("codeOutput").hidden=!codeVisible;$("toggleCode").textContent=codeVisible?"Hide code":"Show code"};
$("clearGraph").onclick=()=>{if(customEditingId){nodes=nodes.filter(n=>["custominput","customoutput"].includes(n.type));links=[];nextNode=Math.max(nextNode,...nodes.map(n=>Number(n.id)||0))+1}else{nodes=[];links=[];selectedNode=null}renderAll();status("Graph cleared")};
$("fitGraph").onclick=()=>{$("workspace").scrollTo({left:0,top:0,behavior:"smooth"});status("Camera reset to top-left")};
$("projectName").addEventListener("input",renderCode);
$("workspace").addEventListener("scroll",()=>{drawWires();drawGraphOverview()});
window.addEventListener("keydown",e=>{if(e.key==="Escape"){pendingPin=null;renderNodes()}if((e.key==="Delete"||e.key==="Backspace")&&selectedNode&&!["custominput","customoutput"].includes(getNode(selectedNode)?.type)&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName)){nodes=nodes.filter(n=>n.id!==selectedNode);links=links.filter(l=>l.from!==selectedNode&&l.to!==selectedNode);selectedNode=null;renderAll()}});
window.addEventListener("cstudio:load-server-script",async event=>{
 const entry=event.detail?.entry;
 const button=event.detail?.button;
 if(!entry)return;
 try{
  let project=entry.payload;
  if(typeof project==="string")project=JSON.parse(project);
  if(!project||!Array.isArray(project.nodes))throw new Error("This community entry does not contain a valid Blueprint project.");
  await loadProjectWithProgress(project);
  currentLibraryId=null;
  $("libraryPanel").hidden=true;
  status("Loaded community script: "+(entry.name||project.projectName||"Blueprint project"));
 }catch(error){
  if(button){button.disabled=false;button.textContent="Load into Canvas"}
  $("exploreStatus").textContent=error?.message||"Could not load this community script.";
 }
});
renderAll();
const saved=BlueprintStorage.load();if(saved)loadState(saved);
})();