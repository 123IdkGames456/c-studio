(() => {
const $ = id => document.getElementById(id);
const defs = BlueprintBlocks.defs;
let nodes = [], links = [], variables = [], nextNode = 1, nextVariable = 1;
let selectedNode = null, pendingPin = null, activeCategory = "All", codeVisible = true, activeView = "graph";
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
 const d=getDef(n?.type);
 if(n?.type==="literal")return [];
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
function actualOutputType(n){
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
  if(source)return actualOutputType(source);
 }
 const expected=expectedInputType(n,p);
 return expected==="dynamic"?"any":expected;
}
function typesCompatible(from,to){
 if(from==="none")return false;
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
  let fromType=actualOutputType(n);
  if(n?.type==="getcomponentvalue")fromType=nodeOutputs(n).find(p=>p.id===l.fromPin)?.type||"none";
  return !!input&&inputActive(target,input)&&typesCompatible(fromType,expectedInputType(target,input));
 });
}
function removeIncompatibleLinksForInput(nodeId){
 const n=getNode(nodeId),td=getDef(n?.type);
 links=links.filter(l=>{
  if(l.kind!=="data"||l.to!==nodeId)return true;
  const source=getNode(l.from),input=nodeInputs(n).find(p=>p.id===l.toPin);
  return !!input&&inputActive(n,input)&&typesCompatible(actualOutputType(source),expectedInputType(n,input));
 });
}
const allCategories = ["All", ...BlueprintBlocks.categories];
function status(s){$("graphStatus").textContent=" · "+s}
function defaultNodePosition(){
 const workspace=$("workspace"),canvas=$("canvas"),wr=workspace.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
 const centerX=wr.left+workspace.clientWidth/2,centerY=wr.top+workspace.clientHeight/2;
 return {x:Math.max(0,Math.min(26900,centerX-cr.left+workspace.scrollLeft-125)),y:Math.max(0,Math.min(19400,centerY-cr.top+workspace.scrollTop-65))};
}
function addNode(type,x,y,values={}) {
 const d=getDef(type); if(!d)return;
 const center=defaultNodePosition();
 const n={id:nextNode++,type,x:x??center.x,y:y??center.y,values:{}};
 (d.fields||[]).forEach(f=>n.values[f.id]=values[f.id]??f.default??(f.options?f.options[0][0]:""));
 if(type==="getvar"||type==="setvar") n.values.variable=values.variable??variables[0]?.id??"";
 nodes.push(n);selectedNode=n.id;renderAll();return n;
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
 $("modalTitle").textContent=existing?"Edit variable":"Create variable";
 $("modalConfirm").textContent=existing?"Save":"Create";
 $("modalBody").innerHTML='<div class="form-row"><label>Variable name</label><input id="varName" value="'+esc(existing?.name||"")+'" placeholder="MoveSpeed"></div><div class="form-row"><label>Data type</label><select id="varType">'+BlueprintTypes.all.map(t=>'<option '+(t===(existing?.type||"float")?"selected":"")+'>'+esc(t)+'</option>').join("")+'<option value="Vector2">Vector2</option><option value="Vector3">Vector3</option><option value="Vector4">Vector4</option><option value="List<int>">List&lt;int&gt;</option><option value="List<float>">List&lt;float&gt;</option><option value="List<string>">List&lt;string&gt;</option><option value="List<GameObject>">List&lt;GameObject&gt;</option><option value="List<Transform>">List&lt;Transform&gt;</option><option value="List<MonoBehaviour>">List&lt;MonoBehaviour&gt;</option><option value="List<Vector2>">List&lt;Vector2&gt;</option><option value="List<Vector3>">List&lt;Vector3&gt;</option><option value="List<Vector4>">List&lt;Vector4&gt;</option><option value="Dictionary<string, GameObject>">Dictionary&lt;string, GameObject&gt;</option><option value="GameObject[]">GameObject[]</option><option value="Transform[]">Transform[]</option><option value="Vector3[]">Vector3[]</option></select></div><div class="form-row"><label>Inspector and access</label><select id="varAccess"><option value="private-inspector">Private, visible in Inspector</option><option value="public-inspector">Public, visible in Inspector</option><option value="private">Private, hidden in Inspector</option><option value="public-hidden">Public, hidden from Inspector</option></select></div><div class="form-row"><label>Initial C# value</label><input id="varInitial" value="'+esc(existing?.initial??"")+'" placeholder="Leave empty for the type default"></div><div class="subtle">Use a valid C# expression. Examples: 100, 5f, true, "Player", Vector3.zero, new List&lt;int&gt;().</div>';
 $("varAccess").value=existing?.access||"private-inspector";
 $("modal").hidden=false;
 $("modalConfirm").onclick=()=>{const data={name:$("varName").value,type:$("varType").value,access:$("varAccess").value,initial:$("varInitial").value.trim()||BlueprintTypes.defaultValue($("varType").value)};if(existing){if(variables.some(v=>v.id!==existing.id&&v.name===data.name)){alert("That variable name already exists.");return}Object.assign(existing,data)}else{const made=addVariable(data);if(!made)return} $("modal").hidden=true;renderAll()};
}
function renderCategories(){ $("categories").innerHTML=allCategories.map(c=>'<button class="category '+(c===activeCategory?"active":"")+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join("");$("categories").querySelectorAll("button").forEach(b=>b.onclick=()=>{activeCategory=b.dataset.category;renderCategories();renderBlocks()})}
function renderBlocks(){
 const q=$("blockSearch").value.toLowerCase().trim();
 const filtered=defs.filter(d=>(activeCategory==="All"||d.category===activeCategory)&&(!q||[d.name,d.category,d.desc,...(d.aliases||[]),...(d.fields||[]).flatMap(f=>[f.label,...(f.options||[]).map(o=>o[1])])].join(" ").toLowerCase().includes(q)));
 const groups=[...new Set(filtered.map(d=>d.category))];
 $("blockList").innerHTML=groups.map(category=>'<section class="block-category-section"><div class="block-category-heading"><span>'+esc(category)+'</span><small>'+filtered.filter(d=>d.category===category).length+' blocks</small></div>'+filtered.filter(d=>d.category===category).map(d=>'<button class="block-item" data-type="'+d.id+'" style="--accent:'+d.color+'"><span class="block-dot"></span><span class="block-text"><strong>'+esc(d.name)+'</strong><small>'+esc(d.desc)+'</small></span></button>').join("")+'</section>').join("")||'<div class="subtle">No blocks found. Try a synonym, symbol, or operation name.</div>';
 $("blockList").querySelectorAll("[data-type]").forEach(b=>{
  b.onclick=e=>e.preventDefault();
  b.addEventListener("pointerdown",e=>{
   if(e.button!==0)return;
   e.preventDefault();
   const type=b.dataset.type,workspace=$("workspace");
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
     draggedNode.y=Math.max(0,Math.min(19400,p.y-22));
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
 if(f.type==="checkbox")return '<label class="node-field checkbox-field"><span>'+esc(f.label)+'</span><input data-field="'+f.id+'" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';
 if(f.type==="variable"){
  const expected=n.type==="setcomponent"&&f.id==="componentVariable"?(n.values.componentType||"Component"):(f.expected||null);
  const list=variables.filter(v=>f.allowAll&&n.type!=="setcomponent"||!expected||v.type===expected||v.type==="Component"||v.type==="MonoBehaviour"||v.type==="object"||(n.type==="setcomponent"&&BlueprintTypes.unity.includes(v.type)));
  return '<label class="node-field"><span>'+esc(f.label)+'</span><select data-field="'+f.id+'"><option value="">Choose variable…</option>'+list.map(v=>'<option value="'+v.id+'" '+(val===v.id?"selected":"")+'>'+esc(v.name)+' · '+esc(v.type)+'</option>').join("")+'</select></label>';
 }
 if(f.type==="select")return '<label class="node-field"><span>'+esc(f.label)+'</span><select data-field="'+f.id+'">'+f.options.map(o=>'<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?"selected":"")+'>'+esc(o[1])+'</option>').join("")+'</select></label>';
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
  (d.fields||[]).forEach(f=>html+=fieldHtml(n,f));
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
   if(n.type==="getcomponentvalue"||n.type==="vectorsplit3"||n.type==="vectorsplit2"||n.type==="quaternionsplit"){
    const outs=nodeOutputs(n);
    if(n.type==="getcomponentvalue"&&!connectedComponentType(n))html+='<div class="node-description">Connect a typed component to show its properties.</div>';
    outs.forEach(p=>{html+='<div class="pin-row output-row"><span class="output-info"><span class="output-name">'+esc(p.label)+'</span><span class="pin-type-badge output-type-badge">'+esc(p.type)+'</span></span><button class="pin out" data-direction="output" data-kind="data" data-type="'+esc(p.type)+'" data-pin="'+p.id+'" title="Drag to connect '+esc(p.label)+'"></button></div>'})
   }
   if(d.valueOut&&actualOutputType(n)!=="none"&&n.type!=="getcomponentvalue"){
    const outputType=actualOutputType(n);
    const outputLabel=outputType==="dynamic"?(n.type==="getvar"?"Choose variable":"Select type"):outputType;
    html+='<div class="pin-row output-row"><span class="output-info"><span class="output-name">Output</span><span class="pin-type-badge output-type-badge">'+esc(outputLabel)+'</span></span><button class="pin out" data-direction="output" data-kind="data" data-type="'+esc(outputType)+'" data-pin="value" title="Drag to connect output"></button></div>';
   }
   if(d.flowOut&&!(n.type==="if"&&(n.values?.branchMode||"Exec")!=="Exec"))d.flowOut.forEach(p=>html+='<div class="pin-row flow-output-row"><span class="output-name">'+esc(p)+'</span><button class="pin out exec-pin" data-direction="output" data-kind="flow" data-type="exec" data-pin="'+p+'" title="Drag to connect output"></button></div>');
  html+='</div>';el.innerHTML=html;
  el.addEventListener("click",e=>{if(e.target.closest(".pin, input, select, textarea, button, label"))return;selectedNode=n.id;renderNodes();renderInspector()});
  el.addEventListener("contextmenu",e=>{e.preventDefault();e.stopPropagation();selectedNode=n.id;showContextMenu(e.clientX,e.clientY,[{label:"Duplicate node",action:()=>{const copy=addNode(n.type,n.x+15,n.y+15,{...n.values});if(copy){copy.color=n.color||"";selectedNode=copy.id;renderAll();status("Node duplicated · moved 15 px down and right")} }},{label:"Delete node",action:()=>{nodes=nodes.filter(x=>x.id!==n.id);links=links.filter(l=>l.from!==n.id&&l.to!==n.id);if(selectedNode===n.id)selectedNode=null;renderAll();status("Node deleted")}},{label:"Node color",submenu:[{label:"Default",color:"",action:()=>setNodeColor(n,"")},{label:"Blue",color:"#648cff",action:()=>setNodeColor(n,"#648cff")},{label:"Green",color:"#43b581",action:()=>setNodeColor(n,"#43b581")},{label:"Yellow",color:"#e0b64f",action:()=>setNodeColor(n,"#e0b64f")},{label:"Orange",color:"#e98b45",action:()=>setNodeColor(n,"#e98b45")},{label:"Red",color:"#df626c",action:()=>setNodeColor(n,"#df626c")},{label:"Purple",color:"#ad7ce8",action:()=>setNodeColor(n,"#ad7ce8")},{label:"Pink",color:"#e783b6",action:()=>setNodeColor(n,"#e783b6")},{label:"Gray",color:"#8e99aa",action:()=>setNodeColor(n,"#8e99aa")}]}]);});
  const head=el.querySelector(".node-head");
  head.addEventListener("pointerdown",e=>{if(e.target.closest("button,input,select"))return;selectedNode=n.id;const sx=e.clientX,sy=e.clientY,ox=n.x,oy=n.y;head.setPointerCapture?.(e.pointerId);function move(ev){n.x=Math.max(0,Math.min(26900,ox+ev.clientX-sx));n.y=Math.max(0,Math.min(19400,oy+ev.clientY-sy));el.style.left=n.x+"px";el.style.top=n.y+"px";drawWires()}function end(){window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",end);renderInspector()}window.addEventListener("pointermove",move);window.addEventListener("pointerup",end);e.preventDefault()});
  el.querySelectorAll("[data-field]").forEach(input=>{
   input.addEventListener(input.type==="checkbox"?"input":"change",()=>{
    const field=input.dataset.field;
    n.values[field]=input.type==="checkbox"?String(input.checked):input.value;if(n.type==="literal"&&field==="value"&&n.values.type==="int"&&input.type!=="checkbox"){n.values[field]=String(Math.trunc(Number(input.value)||0));input.value=n.values[field]}
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
   if(!source||!target||!input||!typesCompatible(actualOutputType(source),expectedInputType(target,input)))return;
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
  const outType=actualOutputType(from), input=nodeInputs(to).find(p=>p.id===pin);
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
 items.forEach(item=>{const row=document.createElement("button");row.type="button";row.className="context-menu-item";row.textContent=item.label;if(item.color!==undefined){const swatch=document.createElement("span");swatch.className="context-color-swatch";swatch.style.background=item.color||"#202531";row.prepend(swatch)}if(item.submenu){row.classList.add("has-submenu");row.textContent=item.label+"  ›";row.onclick=e=>{e.stopPropagation();const r=row.getBoundingClientRect();showContextMenu(r.right,r.top,item.submenu)}}else row.onclick=()=>{closeContextMenu();item.action()};menu.appendChild(row)});
 document.body.appendChild(menu);const r=menu.getBoundingClientRect();if(r.right>window.innerWidth)menu.style.left=Math.max(4,window.innerWidth-r.width-4)+"px";if(r.bottom>window.innerHeight)menu.style.top=Math.max(4,window.innerHeight-r.height-4)+"px";setTimeout(()=>document.addEventListener("pointerdown",outsideContextMenu,true),0);
}
function renderVariables(){
 $("variableList").innerHTML=variables.map(v=>'<div class="variable-card"><div class="variable-top"><strong>'+esc(v.name)+'</strong><span class="type-pill">'+esc(v.type)+'</span></div><div class="variable-meta">'+esc(v.access==="public-hidden"?"Public · hidden from Inspector":v.access==="public-inspector"?"Public · Inspector":v.access==="private"?"Private · hidden":"Private · Inspector")+' · '+esc(v.initial)+'</div><div class="variable-buttons"><button data-edit-var="'+v.id+'">Edit</button><button data-delete-var="'+v.id+'">Delete</button></div></div>').join("")||'<div class="subtle">No variables yet. Create one to use it in Get Variable or Set Variable blocks.</div>';
 $("variableList").querySelectorAll("[data-edit-var]").forEach(b=>b.onclick=()=>openVariableModal(getVar(b.dataset.editVar)));
 $("variableList").querySelectorAll("[data-delete-var]").forEach(b=>b.onclick=()=>{const id=b.dataset.deleteVar;variables=variables.filter(v=>v.id!==id);nodes.forEach(n=>{if(n.values.variable===id)n.values.variable="";if(n.values.componentVariable===id)n.values.componentVariable=""});links=links.filter(l=>!((getNode(l.from)?.type==="getvar"||getNode(l.to)?.type==="setvar")&&l.kind==="data"));renderAll()});
}
function renderInspector(){
 const n=getNode(selectedNode);if(!n){$("nodeInspector").innerHTML='<p class="subtle">Select a node to edit its settings.</p>';return}
 const d=getDef(n.type);
 let html='<div class="subtle">'+esc(d.name)+' · '+esc(d.category)+'</div>';
 (d.fields||[]).forEach(f=>{if(n.type==="setcomponent"&&f.type==="checkbox")return;let val=n.values[f.id]??f.default??(f.options?f.options[0][0]:"");if(f.type==="select")html+='<label>'+esc(f.label)+'</label><select data-inspect="'+f.id+'">'+f.options.map(o=>'<option value="'+esc(o[0])+'" '+(String(val)===String(o[0])?"selected":"")+'>'+esc(o[1])+'</option>').join("")+'</select>';else if(f.type==="variable")html+='<label>'+esc(f.label)+'</label><select data-inspect="'+f.id+'"><option value="">Choose variable…</option>'+variables.map(v=>'<option value="'+v.id+'" '+(v.id===val?"selected":"")+'>'+esc(v.name)+' · '+esc(v.type)+'</option>').join("")+'</select>';else if(n.type==="literal"&&f.id==="value"&&(n.values.type||"int")==="bool")html+='<label class="node-field checkbox-field"><span>Value</span><input data-inspect="value" type="checkbox" '+(val==="true"||val===true?"checked":"")+'></label>';else{const literalType=n.type==="literal"&&f.id==="value"?(n.values.type||"int"):null;const inputType=["int","float","double","long"].includes(literalType)?"number":"text";const step=literalType==="int"||literalType==="long"?"1":literalType==="float"||literalType==="double"?"any":"";html+='<label>'+esc(f.label)+'</label><input data-inspect="'+f.id+'" type="'+inputType+'" '+(step?'step="'+step+'"':"")+' value="'+esc(val)+'">';}});
 if(n.type==="setcomponent"){
  const ct=connectedComponentType(n);
  html+='<div class="inspector-section"><strong>Component properties</strong></div>';
  if(ct){(componentProperties[ct]||[]).forEach(([id,label])=>{const checked=n.values["use_"+id]==="true";html+='<label class="node-field checkbox-field component-toggle"><span>'+esc(label)+'</span><input data-inspect="use_'+id+'" type="checkbox" '+(checked?"checked":"")+'></label>';});}
  else html+='<p class="subtle">Connect a component or choose a component variable to show its supported properties.</p>';
 }
 html+='<div style="margin-top:15px"><button id="deleteNode" style="width:100%">Delete node</button></div>';
 $("nodeInspector").innerHTML=html;
 $("nodeInspector").querySelectorAll("[data-inspect]").forEach(el=>el.addEventListener(el.type==="checkbox"?"input":"change",()=>{const field=el.dataset.inspect;n.values[field]=el.type==="checkbox"?String(el.checked):el.value;if(n.type==="literal"&&field==="value"&&n.values.type==="int"&&el.type!=="checkbox"){n.values[field]=String(Math.trunc(Number(el.value)||0));el.value=n.values[field]}const componentField=n.type==="setcomponent"&&field.startsWith("use_");if(["type","variable","componentType","componentVariable","toType","outputType","operandType","vectorType","property"].includes(field)||field.startsWith("use_")||(field==="operation"&&["transform","gameobject"].includes(n.type)))removeIncompatibleLinksForOutput(n.id);removeIncompatibleLinksForInput(n.id);if(componentField){pruneIncompatibleLinks();renderNodes();renderInspector();renderCode()}else renderAll()}));
 $("deleteNode").onclick=()=>{nodes=nodes.filter(x=>x.id!==n.id);links=links.filter(l=>l.from!==n.id&&l.to!==n.id);selectedNode=null;renderAll()};
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
 const result=BlueprintCompiler.compile(nodes,links,variables,$("projectName").value||"BlueprintScript");
 $("codeOutput").textContent=result.code;
 $("diagnostics").innerHTML=result.diagnostics.length?result.diagnostics.map(x=>'<div class="warning">⚠ '+esc(x)+'</div>').join(""):'<span class="status-good">✓ No basic graph issues detected.</span>';
 $("compileStatus").textContent=result.diagnostics.length?" · "+result.diagnostics.length+" issue(s)":" · Live preview";
}
function pruneIncompatibleLinks(){
 links=links.filter(l=>{
  if(l.kind!=="data")return true;
  const source=getNode(l.from),target=getNode(l.to),td=getDef(target?.type);
  const input=nodeInputs(target).find(p=>p.id===l.toPin);
  return !!source&&!!input&&inputActive(target,input)&&typesCompatible(actualOutputType(source),expectedInputType(target,input));
 }
 );
}
function importCSharp(source,fileName){
 const clean=String(source||"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/(^|[^:])\/\/.*$/gm,"$1");
 const classMatch=clean.match(/\bclass\s+([A-Za-z_]\w*)/);
 const className=classMatch?.[1]||String(fileName||"ImportedScript").replace(/\.cs$/i,"").replace(/[^A-Za-z0-9_]/g,"")||"ImportedScript";
 const hasStart=/\bvoid\s+Start\s*\(/.test(clean),hasUpdate=/\bvoid\s+Update\s*\(/.test(clean);
 const logMatches=[...clean.matchAll(/Debug\.(LogWarning|LogError|Log)\s*\((.*?)\)\s*;/gs)];
 const recognized=logMatches.length>0||hasStart||hasUpdate;
 if(!recognized){alert("This importer currently recognizes Unity Start()/Update() methods and Debug.Log/LogWarning/LogError statements. This file did not contain a supported pattern, so the current graph was kept.");return}
 nodes=[];links=[];variables=[];nextNode=1;nextVariable=1;
 $("projectName").value=className;
 const eventTypes=[];
 if(hasStart||(!hasStart&&!hasUpdate&&logMatches.length))eventTypes.push({type:"start",label:"Start"});
 if(hasUpdate)eventTypes.push({type:"update",label:"Update"});
 let y=70, warnings=[];
 eventTypes.forEach((event,index)=>{
  const ev=addNode(event.type,70,y);ev.x=70;ev.y=y;
  let previous=ev;
  const methodMatch=clean.match(new RegExp("\\bvoid\\s+"+event.label+"\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}"));
  const body=methodMatch?.[1]||"";
  const logs=[...body.matchAll(/Debug\.(LogWarning|LogError|Log)\s*\((.*?)\)\s*;/gs)];
  logs.forEach((m,i)=>{
   const expr=m[2].trim(), level=m[1]==="LogWarning"?"warning":m[1]==="LogError"?"error":"log";
   const dbg=addNode("debug",390+i*280,y,{level,message:expr.replace(/^["']|["']$/g,"")});
   links.push({from:previous.id,fromPin:"Then",to:dbg.id,toPin:"Exec",kind:"flow"});
   previous=dbg;
   const mathMatch=expr.match(/^\(?\s*(-?\d+(?:\.\d+)?f?)\s*\)?\s*([+*/%-])\s*\(?\s*(-?\d+(?:\.\d+)?f?)\s*\)?$/);
   if(mathMatch){
    const op={"+":"add","-":"subtract","*":"multiply","/":"divide","%":"modulo"}[mathMatch[2]];
    const numericType= /[.f]/i.test(mathMatch[1]+mathMatch[3])?"float":"int";
    const a=addNode("literal",390+i*280,y+185,{type:numericType,value:mathMatch[1].replace(/f$/i,"")});
    const b=addNode("literal",390+i*280,y+355,{type:numericType,value:mathMatch[3].replace(/f$/i,"")});
    const calc=addNode("math",650+i*280,y+245,{operation:op,outputType:numericType});
    links.push({from:a.id,fromPin:"value",to:calc.id,toPin:"a",kind:"data"},{from:b.id,fromPin:"value",to:calc.id,toPin:"b",kind:"data"},{from:calc.id,fromPin:"value",to:dbg.id,toPin:"value",kind:"data"});
    dbg.values.message="";
   }else if(/^["']/.test(expr)){
    dbg.values.message=expr.slice(1,-1);
   }else{
    warnings.push("Could not convert expression: "+expr);
   }
  });
  y+=Math.max(360,logs.length*440);
 });
 if(!hasStart&&!hasUpdate&&logMatches.length){
  const ev=addNode("start",70,70);
  let previous=ev;
  logMatches.forEach((m,i)=>{
   const expr=m[2].trim(),level=m[1]==="LogWarning"?"warning":m[1]==="LogError"?"error":"log";
   const dbg=addNode("debug",390+i*280,70,{level,message:/^["']/.test(expr)?expr.slice(1,-1):expr});
   links.push({from:previous.id,fromPin:"Then",to:dbg.id,toPin:"Exec",kind:"flow"});previous=dbg;
   if(!/^["']/.test(expr))warnings.push("Imported expression as text because it was outside the supported expression subset: "+expr);
  });
 }
 selectedNode=nodes[0]?.id??null;
 renderAll();
 status("Imported C# · "+nodes.length+" nodes");
 if(warnings.length)alert("Import completed with some expressions left as text:\n\n"+[...new Set(warnings)].slice(0,8).join("\n"));
}
function renderAll(){pruneIncompatibleLinks();renderCategories();renderBlocks();renderVariables();renderNodes();renderInspector();renderCode()}

let canvasPan=null;
$("workspace").addEventListener("pointerdown",e=>{
 if(e.button!==0)return;
 if(e.target.closest(".node,button,input,select,textarea,a,.pin,.blueprint-context-menu"))return;
 const workspace=$("workspace");
 canvasPan={x:e.clientX,y:e.clientY,left:workspace.scrollLeft,top:workspace.scrollTop,pointerId:e.pointerId};
 workspace.classList.add("panning");
 workspace.setPointerCapture?.(e.pointerId);
 e.preventDefault();
});
$("workspace").addEventListener("pointermove",e=>{
 if(!canvasPan||e.pointerId!==canvasPan.pointerId)return;
 const workspace=$("workspace");
 workspace.scrollLeft=canvasPan.left-(e.clientX-canvasPan.x);
 workspace.scrollTop=canvasPan.top-(e.clientY-canvasPan.y);
});
function stopCanvasPan(e){
 if(!canvasPan||e.pointerId!==canvasPan.pointerId)return;
 canvasPan=null;
 $("workspace").classList.remove("panning");
}
$("workspace").addEventListener("pointerup",stopCanvasPan);
$("workspace").addEventListener("pointercancel",stopCanvasPan);
function snapshot(){return {projectName:$("projectName").value,nodes,links,variables,nextNode,nextVariable}}
function loadState(s){if(!s||!Array.isArray(s.nodes))return;variables=s.variables||[];nodes=s.nodes.map(n=>{const d=getDef(n.type),defaults={};(d?.fields||[]).forEach(f=>defaults[f.id]=f.default??(f.options?f.options[0][0]:""));return {...n,values:{...defaults,...(n.values||{})}}});links=s.links||[];nextNode=s.nextNode||Math.max(0,...nodes.map(n=>Number(n.id)||0))+1;nextVariable=s.nextVariable||variables.length+1;$("projectName").value=s.projectName||"My Blueprint Project";selectedNode=nodes[0]?.id??null;renderAll()}

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
$("modalClose").onclick=$("modalCancel").onclick=()=>{$("modal").hidden=true};
$("starterExample").onclick=example;
 $("loadTemplate").onclick=openTemplates;
$("newProject").onclick=()=>{if(confirm("Create a new project? Unsaved changes in the current graph will be replaced.")){nodes=[];links=[];variables=[];nextNode=1;nextVariable=1;selectedNode=null;$("projectName").value="My Blueprint Project";renderAll();status("New project")}};
$("saveProject").onclick=()=>{try{BlueprintStorage.save(snapshot());status("Saved locally")}catch(e){alert("Could not save locally: "+e.message)}};
$("loadProject").onclick=()=>{const s=BlueprintStorage.load();if(s)loadState(s);else $("fileInput").click()};
$("fileInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{loadState(JSON.parse(await f.text()));status("Project loaded")}catch(err){alert("Invalid project JSON.")}e.target.value=""};
$("importCSharp").onclick=()=>$("csharpInput").click();
$("csharpInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{importCSharp(await f.text(),f.name)}catch(err){alert("Could not import this C# file: "+err.message)}e.target.value=""};
$("downloadProject").onclick=()=>BlueprintStorage.download(BlueprintStorage.safeName($("projectName").value)+".json",BlueprintStorage.snapshot(snapshot()),"application/json");
$("exportProject").onclick=()=>BlueprintStorage.download(BlueprintStorage.safeName($("projectName").value)+".cs",$("codeOutput").textContent,"text/plain");
$("copyCode").onclick=async()=>{try{await navigator.clipboard.writeText($("codeOutput").textContent);status("C# copied")}catch(e){const r=document.createRange();r.selectNodeContents($("codeOutput"));const s=getSelection();s.removeAllRanges();s.addRange(r);status("Select and copy the code")}};
$("toggleCode").onclick=()=>{codeVisible=!codeVisible;document.querySelector(".code-panel").classList.toggle("collapsed",!codeVisible);$("codeOutput").hidden=!codeVisible;$("toggleCode").textContent=codeVisible?"Hide code":"Show code"};
$("clearGraph").onclick=()=>{nodes=[];links=[];selectedNode=null;renderAll();status("Graph cleared")};
$("fitGraph").onclick=()=>{$("workspace").scrollTo({left:0,top:0,behavior:"smooth"});status("Camera reset to top-left")};
$("projectName").addEventListener("input",renderCode);
$("workspace").addEventListener("scroll",drawWires);
window.addEventListener("keydown",e=>{if(e.key==="Escape"){pendingPin=null;renderNodes()}if((e.key==="Delete"||e.key==="Backspace")&&selectedNode&&!["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName)){nodes=nodes.filter(n=>n.id!==selectedNode);links=links.filter(l=>l.from!==selectedNode&&l.to!==selectedNode);selectedNode=null;renderAll()}});
renderAll();
const saved=BlueprintStorage.load();if(saved)loadState(saved);
})();