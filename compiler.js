window.BlueprintCompiler = (() => {
const keywords=new Set(("abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while").split(" "));
const numericTypes=new Set(["byte","sbyte","short","ushort","int","uint","long","ulong","float","double","decimal"]);
const allNumeric=["byte","sbyte","short","ushort","int","uint","long","ulong","float","double","decimal"];
const boolProperties=new Set(["useLimits","useMotor","useSpring","autoConfigureConnectedAnchor","configuredInWorldSpace","swapBodies","enableCollision","enablePreprocessing","useGravity","isKinematic","detectCollisions","enableOverlapRecovery","simulated","isTrigger","enabled","loop","playOnAwake","mute","orthographic","isStopped","convex","applyRootMotion","flipX","flipY","receiveShadows"]);
const properties={
 Joint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",massScale:"float",connectedMassScale:"float"},
 FixedJoint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",massScale:"float",connectedMassScale:"float"},
 SpringJoint:{connectedBody:"Rigidbody",anchor:"Vector3",connectedAnchor:"Vector3",autoConfigureConnectedAnchor:"bool",spring:"float",damper:"float",minDistance:"float",maxDistance:"float",tolerance:"float",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool"},
 HingeJoint:{limits:"JointLimits",useLimits:"bool",motor:"JointMotor",spring:"JointSpring",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool",connectedBody:"Rigidbody"},
 HingeJoint2D:{limits:"JointAngleLimits2D",useLimits:"bool",useMotor:"bool",useSpring:"bool",motor:"JointMotor2D",breakForce:"float",breakTorque:"float",enableCollision:"bool",connectedBody:"Rigidbody2D"},
 CharacterJoint:{connectedBody:"Rigidbody",swingAxis:"Vector3",lowTwistLimit:"SoftJointLimit",highTwistLimit:"SoftJointLimit",swing1Limit:"SoftJointLimit",swing2Limit:"SoftJointLimit",twistLimitSpring:"SoftJointLimitSpring",breakForce:"float",breakTorque:"float",enableCollision:"bool",enablePreprocessing:"bool"},
 ConfigurableJoint:{connectedBody:"Rigidbody",xMotion:"ConfigurableJointMotion",yMotion:"ConfigurableJointMotion",zMotion:"ConfigurableJointMotion",angularXMotion:"ConfigurableJointMotion",angularYMotion:"ConfigurableJointMotion",angularZMotion:"ConfigurableJointMotion",targetPosition:"Vector3",targetVelocity:"Vector3",targetRotation:"Quaternion",targetAngularVelocity:"Vector3",linearLimit:"SoftJointLimit",lowAngularXLimit:"SoftJointLimit",highAngularXLimit:"SoftJointLimit",angularYLimit:"SoftJointLimit",angularZLimit:"SoftJointLimit",configuredInWorldSpace:"bool",swapBodies:"bool",projectionDistance:"float",projectionAngle:"float"},
 Joint2D:{connectedBody:"Rigidbody2D",anchor:"Vector2",connectedAnchor:"Vector2",autoConfigureConnectedAnchor:"bool",breakForce:"float",breakTorque:"float",enableCollision:"bool"},
 Collider:{enabled:"bool",isTrigger:"bool"},
 Collider2D:{enabled:"bool",isTrigger:"bool"},
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
function escString(value){return JSON.stringify(String(value??""))}
function safeIdentifier(value,fallback="BlueprintScript",used=new Set()){
 let name=String(value||fallback).replace(/[^A-Za-z0-9_]/g,"_");
 if(!name)name=fallback;
 if(!/^[A-Za-z_]/.test(name))name="_"+name;
 if(keywords.has(name)||["transform","gameObject","enabled","name","tag","Start","Update","FixedUpdate","Awake","OnEnable","OnDisable","GetComponent","Destroy","Instantiate","Debug","Time","Input"].includes(name))name="blueprint_"+name;
 const base=name;let i=2;
 while(used.has(name)){name=base+"_"+i++}
 used.add(name);return name;
}
function cleanNumber(value,type){
 let raw=String(value??"0").trim();
 const suffix={float:"f",double:"d",decimal:"m",long:"L",ulong:"UL",uint:"U",int:"",byte:"",sbyte:"",short:"",ushort:""}[type]??"";
 if(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[fFdDmMlLuU]*$/.test(raw)){
  raw=raw.replace(/[fFdDmMlLuU]+$/,"");
  if(["byte","sbyte","short","ushort","int","uint","long","ulong"].includes(type)&&/[.eE]/.test(raw))return "("+type+")("+raw+")";
  return raw+suffix;
 }
 return typedDefault(type);
}
function compile(inputNodes,inputLinks,inputVars,className){
 const nodes=Array.isArray(inputNodes)?inputNodes:[];
 const links=Array.isArray(inputLinks)?inputLinks:[];
 const vars=Array.isArray(inputVars)?inputVars:[];
 const diagnostics=[],classFields=[],methods=[],extraMethods=[],generatedWaits=new Set();
 const report=message=>{if(!diagnostics.includes(message))diagnostics.push(message)};
 const usedNames=new Set(["Start","Update","FixedUpdate"]);
 const safeClass=safeIdentifier(className||"BlueprintScript","BlueprintScript",new Set());
 usedNames.add(safeClass);
 const varsById=new Map();
 for(const v of vars){
  const entry={...v,codeName:safeIdentifier(v.name,"Variable",usedNames),type:String(v.type||"int")};
  if(varsById.has(v.id))report("Duplicate variable id detected: "+v.name);
  varsById.set(v.id,entry);
 }
 const dataLinks=links.filter(l=>l.kind==="data");
 const findNode=id=>nodes.find(n=>n.id===id);
 const findVar=id=>varsById.get(id);
 const connected=(id,pin)=>links.find(l=>l.kind==="flow"&&l.from===id&&l.fromPin===pin)?.to;
 const dataLink=(id,pin)=>dataLinks.find(l=>l.to===id&&l.toPin===pin);
 const outputConnected=id=>dataLinks.some(l=>l.from===id&&l.fromPin==="value");
 const spawnedNames=new Map(),waitFlagNames=new Map(),waitMethodNames=new Map();
 for(const n of nodes){
  if(n.type==="gameobject"&&(n.values?.operation||"setActive")==="instantiate"&&outputConnected(n.id))spawnedNames.set(n.id,safeIdentifier("__blueprintSpawned_"+n.id,"__blueprintSpawned",usedNames));
  if(n.type==="wait"){
   waitFlagNames.set(n.id,safeIdentifier("__blueprintWaitRunning_"+n.id,"__blueprintWaitRunning",usedNames));
   waitMethodNames.set(n.id,safeIdentifier("__blueprintWait_"+n.id,"__blueprintWait",usedNames));
  }
 }
 const propertyType=(component,property)=>properties[component]?.[property]||"object";
 function nodeType(n){
  if(!n)return "dynamic";
  if(n.type==="getfirsttag")return "GameObject";
   if(["getparent","getchild","findchild"].includes(n.type))return "GameObject";
   if(["getcomponentchildren","getcomponentparent"].includes(n.type))return n.values?.componentType||"Rigidbody";
   if(["getvelocity","vectorcross","vectornormalize"].includes(n.type))return "Vector3";
   if(n.type==="randomsphere")return "Vector3";
   if(n.type==="isgrounded")return "bool";
   if(n.type==="listcount")return "int";
   if(["listcontains","isnull","getactivestate","raycast","spherecast","overlapsphere","stringcontains"].includes(n.type))return "bool";
   if(["stringconcat","stringreplace"].includes(n.type))return "string";
   if(["deltatime","fixedtime","vectordot"].includes(n.type))return "float";
   if(n.type==="createlist")return "List<"+(n.values?.elementType||"GameObject")+">";
   if(n.type==="foreach")return n.values?.elementType||"GameObject";
   if(n.type==="randomrange")return n.values?.resultType||"float";
   if(["clamp","lerp","mathutility"].includes(n.type))return n.values?.valueType||"float";
  if(n.type==="getalltag")return "List<GameObject>";
  if(["listelement","listclosest","listfarthest"].includes(n.type))return n.values?.elementType||"GameObject";
  if(n.type==="if"){
   const mode=n.values?.branchMode||"Exec";
   if(mode!=="Exec"&&mode!=="dynamic")return mode;
   if(mode==="dynamic"){
    const yes=dataLink(n.id,"trueValue"),no=dataLink(n.id,"falseValue");
    return nodeType(yes?findNode(yes.from):no?findNode(no.from):null);
   }
  }
  if(n.type==="literal")return n.values?.type==="null"?"null":(n.values?.type||"int");
  if(n.type==="getvar")return findVar(n.values?.variable)?.type||"dynamic";
  if(n.type==="self")return "GameObject";
  if(n.type==="getcomponent")return n.values?.componentType||"Rigidbody";
  if(n.type==="getcomponentvalue")return propertyType(n.values?.componentType||"Rigidbody",n.values?.property||"mass");
  if(n.type==="literal"&&["Vector2","Vector3","Vector4","Quaternion","Color","Color32"].includes(n.values?.type))return n.values.type;
  if(n.type==="math")return n.values?.outputType||"float";
  if(n.type==="distance"||n.type==="distance2d")return "float";
  if(n.type==="vectorsplit3"||n.type==="vectorsplit2"||n.type==="quaternionsplit")return "dynamic";
  if(n.type==="vectorcombine3")return "Vector3";
  if(n.type==="quaternioncombine")return "Quaternion";
  if(n.type==="vectorcombine2")return "Vector2";
  if(n.type==="fromto")return n.values?.toType||"string";
  if(n.type==="vector")return n.values?.vectorType||"Vector3";
  if(n.type==="compare"||n.type==="logic"||n.type==="input")return "bool";
  if(n.type==="transform"){
   const op=n.values?.operation||"setPosition";
   return op==="getPosition"||op==="getScale"?"Vector3":op==="getRotation"?"Quaternion":"none";
  }
  if(n.type==="gameobject")return (n.values?.operation||"setActive")==="instantiate"?"GameObject":"none";
  return "dynamic";
 }
 function typedDefault(type){
  const defaults={bool:"false",byte:"0",sbyte:"0",short:"0",ushort:"0",int:"0",uint:"0U",long:"0L",ulong:"0UL",float:"0f",double:"0d",decimal:"0m",string:'""',char:"'\\0'",Vector2:"Vector2.zero",Vector2Int:"Vector2Int.zero",Vector3:"Vector3.zero",Vector3Int:"Vector3Int.zero",Vector4:"Vector4.zero",Quaternion:"Quaternion.identity",Color:"Color.white",Color32:"new Color32(255,255,255,255)",Rect:"new Rect()",Bounds:"new Bounds()",LayerMask:"0",GameObject:"null",Transform:"null",Rigidbody:"null",Rigidbody2D:"null",Collider:"null",Collider2D:"null",JointMotor:"new JointMotor()",JointMotor2D:"new JointMotor2D()",JointSpring:"new JointSpring()",JointLimits:"new JointLimits()",JointAngleLimits2D:"new JointAngleLimits2D()",SoftJointLimit:"new SoftJointLimit()",SoftJointLimitSpring:"new SoftJointLimitSpring()",ConfigurableJointMotion:"ConfigurableJointMotion.Free",CapsuleDirection2D:"CapsuleDirection2D.Vertical",AnimatorUpdateMode:"AnimatorUpdateMode.Normal",AnimatorCullingMode:"AnimatorCullingMode.AlwaysAnimate",ShadowCastingMode:"ShadowCastingMode.On",MeshColliderCookingOptions:"MeshColliderCookingOptions.None",RigidbodyConstraints:"RigidbodyConstraints.None",RigidbodyConstraints2D:"RigidbodyConstraints2D.None",RigidbodyType2D:"RigidbodyType2D.Dynamic",DateTime:"default(DateTime)",TimeSpan:"default(TimeSpan)",Guid:"default(Guid)",object:"null"};
  return defaults[type]??"default("+type+")";
 }
 function typedFallback(raw,type){
  const value=String(raw??"").trim();
  if(!value)return typedDefault(type);
  if(numericTypes.has(type))return cleanNumber(value,type);
  if(type==="string"){
   if(value==="null"||value.startsWith('"')||value.startsWith("string.")||value.startsWith("nameof("))return value;
   return escString(value);
  }
  if(type==="bool")return value==="true"||value==="false"?value:"false";
  if(type==="Vector2"&&value==="0")return "Vector2.zero";
  if(type==="Vector3"&&value==="0")return "Vector3.zero";
  if(type==="Vector4"&&value==="0")return "Vector4.zero";
  if(type==="Quaternion"&&value==="0")return "Quaternion.identity";
  if(type==="Color"&&value==="0")return "Color.white";
  const enumDefaults={RigidbodyConstraints:"RigidbodyConstraints.None",RigidbodyConstraints2D:"RigidbodyConstraints2D.None",RigidbodyType2D:"RigidbodyType2D.Dynamic",ConfigurableJointMotion:"ConfigurableJointMotion.Free",CapsuleDirection2D:"CapsuleDirection2D.Vertical",AnimatorUpdateMode:"AnimatorUpdateMode.Normal",AnimatorCullingMode:"AnimatorCullingMode.AlwaysAnimate",ShadowCastingMode:"ShadowCastingMode.On",MeshColliderCookingOptions:"MeshColliderCookingOptions.None"};
  if(enumDefaults[type]&&value==="0")return enumDefaults[type];
  if(Object.prototype.hasOwnProperty.call(enumDefaults,type)&&/^-?\d+$/.test(value))return "("+type+")"+value;
  return value;
 }
 function convertNumeric(expr,from,to){
  if(from===to||!numericTypes.has(from)||!numericTypes.has(to))return expr;
  return "("+to+")("+expr+")";
 }
 function fromToExpression(n,seen){
  const from=n.values?.fromType||"float",to=n.values?.toType||"string";
  const raw=valueForInput(n,"value",new Set(seen),from);
  if(from===to)return raw;
  const numericFrom=numericTypes.has(from),numericTo=numericTypes.has(to);
  if(to==="string")return "("+raw+").ToString()";
  if(from==="string"){
   const parse={bool:"bool.Parse",byte:"byte.Parse",sbyte:"sbyte.Parse",short:"short.Parse",ushort:"ushort.Parse",int:"int.Parse",uint:"uint.Parse",long:"long.Parse",ulong:"ulong.Parse",float:"float.Parse",double:"double.Parse",decimal:"decimal.Parse"};
   if(parse[to]){
    if(to==="bool")return "bool.Parse("+raw+")";
    return parse[to]+"("+raw+", System.Globalization.CultureInfo.InvariantCulture)";
   }
  }
  if(to==="bool"){
   if(from==="bool")return raw;
   if(numericFrom){const zero={byte:"0",sbyte:"0",short:"0",ushort:"0",int:"0",uint:"0U",long:"0L",ulong:"0UL",float:"0f",double:"0d",decimal:"0m"}[from];return "("+raw+" != "+zero+")"}
  }
  if(from==="bool"&&numericTo){
   const one={byte:"(byte)1",sbyte:"(sbyte)1",short:"(short)1",ushort:"(ushort)1",int:"1",uint:"1U",long:"1L",ulong:"1UL",float:"1f",double:"1d",decimal:"1m"}[to]||"1";
   const zero={byte:"(byte)0",sbyte:"(sbyte)0",short:"(short)0",ushort:"(ushort)0",int:"0",uint:"0U",long:"0L",ulong:"0UL",float:"0f",double:"0d",decimal:"0m"}[to]||"0";
   return "("+raw+" ? "+one+" : "+zero+")";
  }
  if(numericFrom&&numericTo){
   if(to==="int"&&from==="float")return "Mathf.CeilToInt("+raw+")";
   if(to==="int"&&from==="double")return "checked((int)Math.Ceiling("+raw+"))";
   if(to==="int"&&from==="decimal")return "checked((int)decimal.Ceiling("+raw+"))";
   if(to==="long"&&["float","double"].includes(from))return "checked((long)Math.Ceiling((double)("+raw+")))";
   if(to==="long"&&from==="decimal")return "checked((long)decimal.Ceiling("+raw+"))";
   return convertNumeric(raw,from,to);
  }
  report("From To cannot safely convert "+from+" to "+to+".");
  return typedDefault(to);
 }
 function coerceExpression(expr,from,to,n){
  if(!to||to==="dynamic"||to==="any"||to==="number"||to==="object"||from===to||from==="dynamic"||from==="any")return expr;
  if(from==="null"&&(to==="string"||to==="object"||!BlueprintTypes.isValue(to)))return expr;
  if(numericTypes.has(from)&&numericTypes.has(to))return convertNumeric(expr,from,to);
  if((from==="object"||from==="UnityEngine.Object")&&(to==="UnityEngine.Object"||BlueprintTypes.unity.includes(to)&&!BlueprintTypes.isValue(to)))return "("+expr+" as "+to+")";
   if(to==="UnityEngine.Object"&&BlueprintTypes.unity.includes(from)&&!BlueprintTypes.isValue(from))return expr;
   if(BlueprintTypes.compatible(from,to))return expr;
  if(to==="Component"&&BlueprintTypes.unity.includes(from))return expr;
  report("Type mismatch: "+from+" cannot be used as "+to+(n?" on "+n.type:"")+".");
  return typedDefault(to);
 }
 function valueExpr(nodeId,seen=new Set(),expectedType=null,outputPin="value"){
  const n=findNode(nodeId);
  if(!n){report("A value input points to a missing node.");return typedDefault(expectedType||"int")}
  if(seen.has(nodeId)){report("A data connection loop was detected at "+n.type+".");return typedDefault(expectedType||nodeType(n))}
  const path=new Set(seen);path.add(nodeId);
  let expression,sourceType=nodeType(n);
  if(n.type==="literal"){
   const type=n.values?.type||"int",raw=n.values?.value??"0";
   if(type==="string")expression=escString(raw);
   else if(type==="null")expression="null";
   else if(type==="bool")expression=raw==="true"||raw===true?"true":"false";
   else if(numericTypes.has(type)){
    const literalType=expectedType&&numericTypes.has(expectedType)?expectedType:type;
    expression=cleanNumber(raw,literalType);
    sourceType=literalType;
   }else expression=typedFallback(raw,type);
  }else if(n.type==="getfirsttag"){
   expression="GameObject.FindGameObjectWithTag("+escString(n.values?.tag??"Player")+")";
   sourceType="GameObject";
  }else if(n.type==="getalltag"){
   expression="new List<GameObject>(GameObject.FindGameObjectsWithTag("+escString(n.values?.tag??"Enemy")+"))";
   sourceType="List<GameObject>";
  }else if(n.type==="listelement"){
   const elementType=n.values?.elementType||"GameObject";
   const list=valueForInput(n,"list",path,"List<"+elementType+">");
   const index=valueForInput(n,"index",path,"int");
   expression="("+list+" != null && "+index+" >= 0 && "+index+" < "+list+".Count ? "+list+"["+index+"] : "+typedDefault(elementType)+")";
   sourceType=elementType;
  }else if(n.type==="listclosest"||n.type==="listfarthest"){
   const elementType=n.values?.elementType||"GameObject";
   const referenceType=n.values?.referenceType||"GameObject";
   const list=valueForInput(n,"list",path,"List<"+elementType+">");
   const reference=valueForInput(n,"reference",path,referenceType);
   const isFar=n.type==="listfarthest";
   const dimensions=elementType==="Vector2"?2:3;
   const vectorType=dimensions===2?"Vector2":"Vector3";
   const toPosition=(expr,type)=>{
    if(type==="GameObject")return dimensions===2?"new Vector2(("+expr+").transform.position.x, ("+expr+").transform.position.y)":"("+expr+").transform.position";
    if(type==="Vector2"&&dimensions===3)return "new Vector3(("+expr+").x, ("+expr+").y, 0f)";
    if(type==="Vector3"&&dimensions===2)return "new Vector2(("+expr+").x, ("+expr+").y)";
    return expr;
   };
   const itemPosition=(item)=>toPosition(item,elementType);
   const referencePosition=toPosition(reference,referenceType);
   const distanceFor=(item)=>vectorType+".Distance("+itemPosition(item)+", "+referencePosition+")";
   const count=list+".Count";
   if(outputPin==="found"){expression="("+list+" != null && "+count+" > 0)";sourceType="bool";}
   else if(outputPin==="index"){
    const op=isFar?">":"<",item=list+"[__i]",best=list+"[__best]";
    expression="("+list+" != null && "+count+" > 0 ? System.Linq.Enumerable.Aggregate(System.Linq.Enumerable.Range(0, "+count+"), 0, (__best, __i) => "+distanceFor(item)+" "+op+" "+distanceFor(best)+" ? __i : __best) : -1)";
    sourceType="int";
   }else{
    const op=isFar?">":"<",item=list+"[__i]",best=list+"[__best]";
    const bestIndex="System.Linq.Enumerable.Aggregate(System.Linq.Enumerable.Range(0, "+count+"), 0, (__best, __i) => "+distanceFor(item)+" "+op+" "+distanceFor(best)+" ? __i : __best)";
    expression="("+list+" != null && "+count+" > 0 ? "+list+"["+bestIndex+"] : "+typedDefault(elementType)+")";
    sourceType=elementType;
   }
  }else if(n.type==="getparent"){const t=valueForInput(n,"target",path,"GameObject");expression="("+t+" != null && "+t+".transform.parent != null ? "+t+".transform.parent.gameObject : null)";sourceType="GameObject";
   }else if(n.type==="getchild"){const t=valueForInput(n,"target",path,"GameObject"),i=valueForInput(n,"index",path,"int");expression="("+t+" != null && "+i+" >= 0 && "+i+" < "+t+".transform.childCount ? "+t+".transform.GetChild("+i+").gameObject : null)";sourceType="GameObject";
   }else if(n.type==="findchild"){const t=valueForInput(n,"target",path,"GameObject"),nm=escString(n.values?.name||"Child");expression="("+t+" != null && "+t+".transform.Find("+nm+") != null ? "+t+".transform.Find("+nm+").gameObject : null)";sourceType="GameObject";
   }else if(n.type==="getcomponentchildren"||n.type==="getcomponentparent"){const ct=n.values?.componentType||"Rigidbody",t=valueForInput(n,"target",path,"GameObject");expression="("+t+" != null ? "+t+".GetComponent"+(n.type==="getcomponentchildren"?"InChildren":"InParent")+"<"+ct+">() : null)";sourceType=ct;
   }else if(n.type==="randomsphere"){expression="UnityEngine.Random.insideUnitSphere";sourceType="Vector3";
   }else if(n.type==="isgrounded"){const c=valueForInput(n,"controller",path,"CharacterController");expression="("+c+" != null && "+c+".isGrounded)";sourceType="bool";
   }else if(n.type==="getvelocity"){const b=valueForInput(n,"body",path,"Rigidbody");expression="("+b+" != null ? "+b+".velocity : Vector3.zero)";sourceType="Vector3";
   }else if(n.type==="raycast"||n.type==="spherecast"){const o=valueForInput(n,"origin",path,"Vector3"),d=valueForInput(n,"direction",path,"Vector3"),max=cleanNumber(n.values?.maxDistance??(n.type==="raycast"?"100":"10"),"float"),radius=cleanNumber(n.values?.radius??"0.5","float"),isSphere=n.type==="spherecast",call=isSphere?"Physics.SphereCast(__o, "+radius+", __d, out __h, __max)":"Physics.Raycast(__o, __d, out __h, __max)",if(outputPin==="hit"||outputPin==="hitObject"||outputPin==="point"){const result="((Func<RaycastHit>)(() => { Vector3 __o = "+o+"; Vector3 __d = "+d+"; float __max = "+max+"; "+draw+" RaycastHit __h; "+call+"; return __h; }))()";sourceType=outputPin==="hit"?"RaycastHit":outputPin==="hitObject"?"GameObject":"Vector3";expression=outputPin==="hit"?result:outputPin==="hitObject"?"("+result+".collider != null ? "+result+".collider.gameObject : null)":result+".point";}else{expression="((Func<bool>)(() => { Vector3 __o = "+o+"; Vector3 __d = "+d+"; float __max = "+max+"; "+draw+" RaycastHit __h; return "+call+"; }))()";sourceType="bool";}
   }else if(n.type==="overlapsphere"){const c=valueForInput(n,"center",path,"Vector3"),radius=cleanNumber(n.values?.radius??"1","float"),debugConnected=!!dataLink(n.id,"showDebug"),debugEnabled=n.values?.showDebug===true||n.values?.showDebug==="true",show=debugConnected?valueForInput(n,"showDebug",path,"bool"):"true",draw=debugConnected?"if ("+show+") __BlueprintDrawWireSphere(__center, __radius, Color.green);":debugEnabled?"__BlueprintDrawWireSphere(__center, __radius, Color.green);":"";expression="((Func<bool>)(() => { Vector3 __center = "+c+"; float __radius = "+radius+"; "+draw+" return Physics.OverlapSphere(__center, __radius).Length > 0; }))()";sourceType="bool";
   }else if(n.type==="createlist"){const t=n.values?.elementType||"GameObject";expression="new List<"+t+">()";sourceType="List<"+t+">";
   }else if(n.type==="listcount"){const link=dataLink(n.id,"list");if(!link){report("Connect a list to Get List Count.");expression="0";}else{const l=valueExpr(link.from,path,null,link.fromPin);expression="(((dynamic)("+l+")) != null ? ((dynamic)("+l+")).Count : 0)";}sourceType="int";
   }else if(n.type==="listcontains"){const t=n.values?.elementType||"GameObject",l=valueForInput(n,"list",path,"List<"+t+">"),v=valueForInput(n,"item",path,t);expression="("+l+" != null && "+l+".Contains("+v+"))";sourceType="bool";
   }else if(n.type==="isnull"){const v=valueForInput(n,"value",path,"object");expression="("+v+" == null)";sourceType="bool";
   }else if(n.type==="getactivestate"){const t=valueForInput(n,"target",path,"GameObject");expression="("+t+" != null && "+t+".activeInHierarchy)";sourceType="bool";
   }else if(n.type==="randomrange"){const t=n.values?.resultType||"float",a=valueForInput(n,"min",path,t),b=valueForInput(n,"max",path,t);expression="UnityEngine.Random.Range("+a+", "+b+")";sourceType=t;
   }else if(n.type==="clamp"){const t=n.values?.valueType||"float",v=valueForInput(n,"value",path,t),a=valueForInput(n,"min",path,t),b=valueForInput(n,"max",path,t);expression="Mathf.Clamp("+v+", "+a+", "+b+")";sourceType=t;
   }else if(n.type==="lerp"){const t=n.values?.valueType||"float",a=valueForInput(n,"a",path,t),b=valueForInput(n,"b",path,t),v=valueForInput(n,"t",path,"float");expression=(t==="Vector2"?"Vector2.Lerp":t==="Vector3"?"Vector3.Lerp":t==="Color"?"Color.Lerp":"Mathf.Lerp")+"("+a+", "+b+", "+v+")";sourceType=t;
   }else if(n.type==="mathutility"){const t=n.values?.valueType||"float",op=n.values?.operation||"abs",v=valueForInput(n,"value",path,t),m={abs:"Abs",round:"Round",floor:"Floor",ceil:"Ceil",sqrt:"Sqrt"};expression=(t==="float"?"Mathf.":"Math.")+(m[op]||"Abs")+"("+v+")";sourceType=t;
   }else if(n.type==="stringconcat"){const a=valueForInput(n,"a",path,"object"),b=valueForInput(n,"b",path,"object");expression="Convert.ToString("+a+") + Convert.ToString("+b+")";sourceType="string";
   }else if(n.type==="stringcontains"){const a=valueForInput(n,"text",path,"string"),b=valueForInput(n,"search",path,"string");expression="("+a+" != null && "+a+".Contains("+b+"))";sourceType="bool";
   }else if(n.type==="stringreplace"){const a=valueForInput(n,"text",path,"string"),b=valueForInput(n,"old",path,"string"),c=valueForInput(n,"replacement",path,"string");expression="("+a+" ?? string.Empty).Replace("+b+", "+c+")";sourceType="string";
   }else if(n.type==="deltatime"){expression="Time.deltaTime";sourceType="float";
   }else if(n.type==="fixedtime"){expression="Time.fixedDeltaTime";sourceType="float";
   }else if(n.type==="vectordot"){expression="Vector3.Dot("+valueForInput(n,"a",path,"Vector3")+", "+valueForInput(n,"b",path,"Vector3")+")";sourceType="float";
   }else if(n.type==="vectorcross"){expression="Vector3.Cross("+valueForInput(n,"a",path,"Vector3")+", "+valueForInput(n,"b",path,"Vector3")+")";sourceType="Vector3";
   }else if(n.type==="vectornormalize"){const v=valueForInput(n,"value",path,"Vector3");expression="("+v+".sqrMagnitude > 0f ? "+v+".normalized : Vector3.zero)";sourceType="Vector3";
   }else if(n.type==="forloop"){expression="__blueprintLoopIndex_"+n.id;sourceType="int";
   }else if(n.type==="foreach"){expression=safeIdentifier(n.values?.itemName||"item","item",new Set());sourceType=n.values?.elementType||"GameObject";
   }else if(["triggerenter","triggerstay","triggerexit"].includes(n.type)){expression="other";sourceType="Collider";
   }else if(["collisionenter","collisionstay","collisionexit"].includes(n.type)){expression="collision";sourceType="Collision";
   }else if(n.type==="self"){
   expression="gameObject";
  }else if(n.type==="getvar"){
   const v=findVar(n.values?.variable);
   if(!v){report("Choose a variable in Get Variable.");expression=typedDefault(expectedType||"int")}
   else expression=v.codeName;
  }else if(n.type==="input"){
   const key=n.values?.key||"Space",mode=n.values?.mode||"down";
   expression="Input.GetKey"+(mode==="held"?"":mode==="up"?"Up":"Down")+"(KeyCode."+key+")";
  }else if(n.type==="getcomponent"){
   const ct=n.values?.componentType||"Rigidbody";
   const target=valueForInput(n,"target",path,"GameObject");
   expression="((GameObject)("+target+"))?.GetComponent<"+ct+">()";
  }else if(n.type==="getcomponentvalue"){
    const prop=outputPin==="value"?"mass":outputPin,target=valueForInput(n,"component",path,"Component");
    const inputLink=dataLink(n.id,"component"),source=inputLink?findNode(inputLink.from):null,ct=source?.type==="getcomponent"?(source.values?.componentType||"Rigidbody"):source?.type==="getvar"?(findVar(source.values?.variable)?.type||"Component"):"Component";
    sourceType=propertyType(ct,prop);
    expression=ct==="Component"?"((dynamic)("+target+"))."+prop:"(("+ct+")("+target+"))."+prop;
   }else if(n.type==="vectorsplit3"||n.type==="vectorsplit2"||n.type==="quaternionsplit"){
   const isQuaternion=n.type==="quaternionsplit";
   const vectorType=isQuaternion?"Quaternion":n.type==="vectorsplit3"?"Vector3":"Vector2";
   const inputPin=isQuaternion?"quaternion":"vector";
   const vector=valueForInput(n,inputPin,path,vectorType);
   const axis=(isQuaternion?["x","y","z","w"]:n.type==="vectorsplit3"?["x","y","z"]:["x","y"]).includes(outputPin)?outputPin:"x";
   sourceType="float";
   expression="("+vector+")."+axis;
  }else if(n.type==="vectorcombine3"||n.type==="vectorcombine2"||n.type==="quaternioncombine"){
   const is2D=n.type==="vectorcombine2",isQuaternion=n.type==="quaternioncombine";
   const x=valueForInput(n,"x",path,"float"),y=valueForInput(n,"y",path,"float");
   const args=is2D?[x,y]:isQuaternion?[x,y,valueForInput(n,"z",path,"float"),valueForInput(n,"w",path,"float")]:[x,y,valueForInput(n,"z",path,"float")];
   sourceType=isQuaternion?"Quaternion":is2D?"Vector2":"Vector3";
   expression="new "+sourceType+"("+args.join(", ")+")";
  }else if(n.type==="distance"||n.type==="distance2d"){
   const is2D=n.type==="distance2d";
   const a=distancePositionExpr(n,"a",path,is2D);
   const b=distancePositionExpr(n,"b",path,is2D);
   expression=(is2D?"Vector2.Distance(":"Vector3.Distance(")+a+", "+b+")";
  }else if(n.type==="fromto"){
   expression=fromToExpression(n,path);
  }else if(n.type==="vector"){
   const type=n.values?.vectorType||"Vector3";
   const x=valueForInput(n,"x",path,"float"),y=valueForInput(n,"y",path,"float");
   const z=valueForInput(n,"z",path,"float"),w=valueForInput(n,"w",path,"float");
   const args=type==="Vector2"?[x,y]:type==="Vector3"?[x,y,z]:type==="Vector4"||type==="Quaternion"||type==="Color"?[x,y,z,w]:type==="Color32"?["(byte)("+x+")","(byte)("+y+")","(byte)("+z+")","(byte)("+w+")"]:null;
   if(args)expression="new "+type+"("+args.join(", ")+")";
   else {report("Choose a supported vector output type.");expression="Vector3.zero"}
  }else if(n.type==="math"){
   const type=n.values?.outputType||"float",op=n.values?.operation||"add";
   const a=valueForInput(n,"a",path,type),b=valueForInput(n,"b",path,type);
   if(op==="power"){
    if(type==="float")expression="Mathf.Pow("+a+", "+b+")";
    else if(type==="decimal")expression="(decimal)Math.Pow((double)("+a+"), (double)("+b+"))";
    else expression="("+type+")Math.Pow((double)("+a+"), (double)("+b+"))";
   }else if(op==="min"||op==="max"){
    const method=op==="min"?"Min":"Max";
    expression=type==="float"?"Mathf."+method+"("+a+", "+b+")":"Math."+method+"("+a+", "+b+")";
   }else{
    const ops={add:"+",subtract:"-",multiply:"*",divide:"/",modulo:"%"};
    expression="("+a+" "+(ops[op]||"+")+" "+b+")";
   }
  }else if(n.type==="if"&&(n.values?.branchMode||"Exec")!=="Exec"){
   const condition=valueForInput(n,"condition",path,"bool");
   const trueValue=valueForInput(n,"trueValue",path,n.values.branchMode==="dynamic"?null:n.values.branchMode);
   const falseValue=valueForInput(n,"falseValue",path,n.values.branchMode==="dynamic"?null:n.values.branchMode);
   sourceType=n.values.branchMode==="dynamic"?nodeType(n):n.values.branchMode;
   expression="("+condition+" ? "+trueValue+" : "+falseValue+")";
  }else if(n.type==="compare"){
   const type=n.values?.operandType||"float",op=n.values?.operation||"eq";
   const a=valueForInput(n,"a",path,type),b=valueForInput(n,"b",path,type);
   const opMap={eq:"==",ne:"!=",gt:">",lt:"<",gte:">=",lte:"<="};
   if(type==="string"&&["gt","lt","gte","lte"].includes(op)){
    expression="(string.CompareOrdinal("+a+", "+b+") "+opMap[op]+" 0)";
   }else if(type==="bool"&&["gt","lt","gte","lte"].includes(op)){
    report("Boolean comparison supports only Equal and Not equal.");
    expression="false";
   }else expression="("+a+" "+(opMap[op]||"==")+" "+b+")";
  }else if(n.type==="logic"){
   const op=n.values?.operation||"and",a=valueForInput(n,"a",path,"bool"),b=valueForInput(n,"b",path,"bool");
   expression=op==="not"?"!("+a+")":"("+a+" "+({and:"&&",or:"||",xor:"^"}[op]||"&&")+" "+b+")";
  }else if(n.type==="transform"){
   const op=n.values?.operation||"setPosition",link=dataLink(n.id,"target");
   if(!link){valueForInput(n,"target",path,"GameObject");sourceType=outputPin==="rotationQuaternion"?"Quaternion":"Vector3";expression=typedDefault(sourceType);}
   else{const target=valueExpr(link.from,new Set(path),"GameObject",link.fromPin)+".transform";
    if(op==="getPosition"){sourceType="Vector3";expression=target+".position";}
    else if(op==="getScale"){sourceType="Vector3";expression=target+".localScale";}
    else if(op==="getRotation"&&outputPin==="rotationQuaternion"){sourceType="Quaternion";expression=target+".rotation";}
    else if(op==="getRotation"){sourceType="Vector3";expression=target+".eulerAngles";}
    else {sourceType=outputPin==="rotationQuaternion"?"Quaternion":"Vector3";expression=typedDefault(sourceType);}
   }
   if(!["getPosition","getRotation","getScale"].includes(op))report("A Transform setter cannot be used as a value output.");
  }else if(n.type==="gameobject"&&(n.values?.operation||"setActive")==="instantiate"){
   expression=spawnedNames.get(n.id)||("__blueprintSpawned_"+n.id);
  }else{
   report("The "+(n.type||"unknown")+" block does not provide a usable value output.");
   expression=typedDefault(expectedType||"int");
  }
  return coerceExpression(expression,sourceType,expectedType,n);
 }
 function distancePositionExpr(n,pin,seen,is2D){
  const mode=n.values?.[pin+"Type"]||"object";
  const vectorType=is2D?"Vector2":"Vector3";
  const zero=is2D?"Vector2.zero":"Vector3.zero";
  const link=dataLink(n.id,pin);
  if(!link){report("Connect an input to Distance "+pin.toUpperCase()+".");return zero;}
  const source=findNode(link.from);
  const sourceType=nodeType(source);
  const expr=valueExpr(link.from,new Set(seen),null,link.fromPin);
  if(mode===vectorType){
   if(sourceType!==vectorType){report("Distance input "+pin.toUpperCase()+" is set to "+vectorType+" but receives "+sourceType+".");return zero;}
   return expr;
  }
  const validObject=sourceType==="GameObject"||sourceType==="Transform"||sourceType==="Component"||BlueprintTypes.unity.includes(sourceType);
  if(!validObject){report("Distance input "+pin.toUpperCase()+" is set to Object / Component but receives "+sourceType+".");return zero;}
  if(sourceType==="GameObject")return is2D?"new Vector2(("+expr+").transform.position.x, ("+expr+").transform.position.y)":"("+expr+").transform.position";
  if(sourceType==="Transform")return is2D?"new Vector2(("+expr+").position.x, ("+expr+").position.y)":"("+expr+").position";
  return is2D?"new Vector2(("+expr+").transform.position.x, ("+expr+").transform.position.y)":"("+expr+").transform.position";
 }
 function valueForInput(n,pin,seen=new Set(),expectedType=null){
  const link=dataLink(n.id,pin);
  if(link)return valueExpr(link.from,seen,expectedType,link.fromPin);
  if((n.type==="vector"||n.type==="literal")&&["x","y","z","w"].includes(pin)&&["Vector2","Vector3","Vector4","Quaternion","Color","Color32"].includes(n.values?.vectorType||n.values?.type))return typedFallback(n.values?.[pin]??(pin==="w"?"1":"0"),expectedType||"float");
  if((n.type==="changerotation"||n.type==="changeposition")&&["x","y","z","w"].includes(pin))return typedFallback(n.values?.[pin]??(pin==="w"?"1":"0"),expectedType||"float");
  if(n.type==="smoothgoto"&&pin==="maxDistance")return typedFallback(n.values?.maxDistance??"1","float");
  if(pin==="minimumValue")return typedFallback(n.values?.minimum??"-45","float");
  if(pin==="maximumValue")return typedFallback(n.values?.maximum??"45","float");
  if(pin==="propertyValueInput")return propertyFallback(n);
  if(pin==="value"&&n.type==="setvar"){
   const v=findVar(n.values?.variable);
   return typedFallback(n.values?.value??"0",expectedType||v?.type||"int");
  }
  if(pin==="value"&&n.type==="fromto")return typedDefault(expectedType||n.values?.fromType||"float");
  if(n.type==="if"&&(pin==="trueValue"||pin==="falseValue")){
   const mode=n.values?.branchMode||"Exec";
   const otherPin=pin==="trueValue"?"falseValue":"trueValue";
   const otherLink=dataLink(n.id,otherPin);
   const fallbackType=mode==="dynamic"?(otherLink?nodeType(findNode(otherLink.from)):"int"):mode;
   return typedDefault(expectedType||fallbackType);
  }
  if(pin==="a"||pin==="b")return typedDefault(expectedType||"int");
  if((n.type==="transform"&&pin==="target")||(n.type==="gameobject"&&pin==="target")||(n.type==="getcomponent"&&pin==="target")||((n.type==="getcomponentvalue"||n.type==="setcomponent")&&pin==="component")||((n.type==="distance"||n.type==="distance2d")&&(pin==="a"||pin==="b"))){report("Connect the required "+(pin==="target"?"Object":pin==="component"?"Component":"input")+" input on "+(n.type||"node")+".");return expectedType?typedDefault(expectedType):"null";}
  const fallbacks={condition:"false",vector:"Vector3.zero"};
  if(fallbacks[pin])return fallbacks[pin];
  if(expectedType)return typedDefault(expectedType);
  return "0";
 }
 function propertyFallback(n){
  const ct=n.values?.componentType||"HingeJoint",prop=n.values?.property||"limits",type=propertyType(ct,prop),raw=n.values?.propertyValue??"0";
  const value=String(raw).trim();
  if(numericTypes.has(type))return typedFallback(value,type);
  if(type==="string")return typedFallback(value,type);
  if(type==="bool")return value==="true"||value==="false"?value:"false";
  const enumDefaults={RigidbodyConstraints:"RigidbodyConstraints.None",RigidbodyConstraints2D:"RigidbodyConstraints2D.None",RigidbodyType2D:"RigidbodyType2D.Dynamic"};
  if(enumDefaults[type]){
   if(/^-?\d+$/.test(value)&&value!=="0")return "("+type+")"+value;
   return enumDefaults[type];
  }
  if(value==="0")return typedDefault(type);
  return value;
 }
 function variableInitializer(v){
  const raw=String(v.initial??"").trim();
  if(!raw)return BlueprintTypes.defaultValue(v.type);
  return typedFallback(raw,v.type);
 }
 function emitFlow(id,indent,visited=new Set()){
  const out=[];let current=id,guard=0;
  while(current&&guard++<nodes.length+2){
   if(visited.has(current)){report("A flow loop was detected. The repeated action was stopped in generated code.");break}
   visited.add(current);
   const n=findNode(current);if(!n)break;
   const p="    ".repeat(indent);
   if(["start","update","fixed","awake","onenable","ondisable","ondestroy","triggerenter","triggerstay","triggerexit","collisionenter","collisionstay","collisionexit","comment"].includes(n.type)){}
   else if(n.type==="breakloop"){out.push(p+"break;");break}
   else if(n.type==="continueloop"){out.push(p+"continue;");break}
   else if(n.type==="forloop"){
    const ix="__blueprintLoopIndex_"+n.id,a=cleanNumber(n.values?.start??"0","int"),b=cleanNumber(n.values?.end??"5","int");out.push(p+"for (int "+ix+" = "+a+"; "+ix+" < "+b+"; "+ix+"++)",p+"{");const body=connected(n.id,"Loop");if(body)out.push(...emitFlow(body,indent+1,new Set(visited)));out.push(p+"}");current=connected(n.id,"Completed");continue;
   }else if(n.type==="foreach"){
    const item=safeIdentifier(n.values?.itemName||"item","item",new Set()),t=n.values?.elementType||"GameObject",l=valueForInput(n,"list",new Set(),"List<"+t+">");out.push(p+"if ("+l+" != null)",p+"{",p+"    foreach ("+t+" "+item+" in "+l+")",p+"    {");const body=connected(n.id,"Loop");if(body)out.push(...emitFlow(body,indent+2,new Set(visited)));out.push(p+"    }",p+"}");current=connected(n.id,"Completed");continue;
   }else if(n.type==="whileloop"){
    const c=valueForInput(n,"condition",new Set(),"bool");out.push(p+"while ("+c+")",p+"{");const body=connected(n.id,"Loop");if(body)out.push(...emitFlow(body,indent+1,new Set(visited)));out.push(p+"}");current=connected(n.id,"Completed");continue;
   }
   else if(n.type==="functionstart"){break;}
   else if(n.type==="callfunction"){
    const fn=nodes.find(x=>x.type==="functionstart"&&String(x.id)===String(n.values?.functionId));
    if(!fn)report("Choose a valid Function Entry node in Call Function.");
    else out.push(p+safeIdentifier(fn.values?.name||"MyFunction","MyFunction",new Set())+"_"+fn.id+"();");
   }
   else if(n.type==="addforce"||n.type==="addtorque"){
    const b=valueForInput(n,"body",new Set(),"Rigidbody"),v=valueForInput(n,n.type==="addforce"?"force":"torque",new Set(),"Vector3"),m=n.type==="addforce"?"AddForce":"AddTorque",fm=n.values?.forceMode||"Force";out.push(p+"if ("+b+" != null) "+b+"."+m+"("+v+", ForceMode."+fm+");");
   }else if(n.type==="moveposition"){const b=valueForInput(n,"body",new Set(),"Rigidbody"),v=valueForInput(n,"position",new Set(),"Vector3");out.push(p+"if ("+b+" != null) "+b+".MovePosition("+v+");");
   }else if(n.type==="moverotation"){const b=valueForInput(n,"body",new Set(),"Rigidbody"),v=valueForInput(n,"rotation",new Set(),"Quaternion");out.push(p+"if ("+b+" != null) "+b+".MoveRotation("+v+");");
   }else if(n.type==="setvelocity"){const b=valueForInput(n,"body",new Set(),"Rigidbody"),v=valueForInput(n,"velocity",new Set(),"Vector3");out.push(p+"if ("+b+" != null) "+b+".velocity = "+v+";");
   }else if(n.type==="listadd"||n.type==="listremove"||n.type==="listclear"){
    const t=n.values?.elementType||"GameObject",l=valueForInput(n,"list",new Set(),"List<"+t+">");if(n.type==="listadd")out.push(p+"if ("+l+" != null) "+l+".Add("+valueForInput(n,"item",new Set(),t)+");");else if(n.type==="listremove")out.push(p+"if ("+l+" != null) "+l+".Remove("+valueForInput(n,"item",new Set(),t)+");");else out.push(p+"if ("+l+" != null) "+l+".Clear();");
   }else if(n.type==="setparent"){const t=valueForInput(n,"target",new Set(),"GameObject"),pl=dataLink(n.id,"parent"),par=pl?valueExpr(pl.from,new Set(),"GameObject",pl.fromPin):"null";out.push(p+"if ("+t+" != null) "+t+".transform.SetParent("+par+" != null ? "+par+".transform : null);");
   }else if(n.type==="setvar"){
    const v=findVar(n.values?.variable);
    if(!v)report("Choose a variable in Set Variable.");
    else out.push(p+v.codeName+" = "+valueForInput(n,"value",new Set(),v.type)+";");
   }else if(n.type==="setcomponent"){
    const sourceLink=dataLink(n.id,"component");
    if(!sourceLink){
     report("Connect a Component input to Set Component Info.");
    }else{
     const source=findNode(sourceLink.from);
     const ct=source?.type==="getcomponent"?(source.values?.componentType||"Rigidbody"):source?.type==="getvar"?(findVar(source.values?.variable)?.type||"Component"):"Component";
     const target=valueExpr(sourceLink.from,new Set(),"Component");
     const available=properties[ct]||{};
     const componentProps=Object.keys(available).filter(prop=>n.values?.["use_"+prop]==="true");
     if(!componentProps.length)report("Enable at least one property supported by the selected component.");
     componentProps.forEach(prop=>{
      const type=available[prop];
      if(!Object.prototype.hasOwnProperty.call(available,prop)){report("The "+prop+" property is unavailable for "+ct+";");return}
      const val=valueForInput(n,prop,new Set(),type);
      const accessType=ct==="Component"?"dynamic":ct;
      const temp="__component_"+n.id+"_"+prop;
      out.push(p+"{",p+"    var "+temp+" = "+(accessType==="dynamic"?"("+target+")":"(("+accessType+")("+target+"))")+";",p+"    if ("+temp+" != null)",p+"    {",p+"        "+temp+"."+prop+" = "+val+";",p+"    }",p+"}");
     });

    }
   }else if(n.type==="changerotation"){
    const targetLink=dataLink(n.id,"target");
    if(!targetLink){valueForInput(n,"target",new Set(),"GameObject");}
    else{
     const target=valueExpr(targetLink.from,new Set(),"GameObject",targetLink.fromPin);
     const x=valueForInput(n,"x",new Set(),"float"),y=valueForInput(n,"y",new Set(),"float"),z=valueForInput(n,"z",new Set(),"float"),w=valueForInput(n,"w",new Set(),"float");
     const delta="new Quaternion("+x+", "+y+", "+z+", "+w+")";
     const isLocal=n.values?.space==="local";
     const rotation=isLocal?"localRotation":"rotation";
     const updated=isLocal?"("+target+".transform."+rotation+" * "+delta+")":"("+delta+" * "+target+".transform."+rotation+")";
     out.push(p+"if ("+target+" != null) "+target+".transform."+rotation+" = "+updated+";");
    }
   }else if(n.type==="changeposition"){
    const targetLink=dataLink(n.id,"target");
    if(!targetLink){valueForInput(n,"target",new Set(),"GameObject");}
    else{
     const target=valueExpr(targetLink.from,new Set(),"GameObject",targetLink.fromPin);
     const x=valueForInput(n,"x",new Set(),"float"),y=valueForInput(n,"y",new Set(),"float"),z=valueForInput(n,"z",new Set(),"float");
     const offset="new Vector3("+x+", "+y+", "+z+")";
     const move=n.values?.space==="local"?target+".transform.TransformDirection("+offset+")":offset;
     out.push(p+"if ("+target+" != null) "+target+".transform.position += "+move+";");
    }
   }else if(n.type==="smoothgoto"){
    const targetLink=dataLink(n.id,"target");
    const destinationLink=dataLink(n.id,"destination");
    const target=targetLink?valueExpr(targetLink.from,new Set(),"GameObject",targetLink.fromPin):valueForInput(n,"target",new Set(),"GameObject");
    const destination=destinationLink?valueExpr(destinationLink.from,new Set(),"Vector3",destinationLink.fromPin):valueForInput(n,"destination",new Set(),"Vector3");
    const maxDistance=valueForInput(n,"maxDistance",new Set(),"float");
    if(!targetLink)report("Connect a GameObject to Smooth Go To.");
    if(!destinationLink)report("Connect a Vector3 destination to Smooth Go To.");
    out.push(p+"if ("+target+" != null) {",p+"    Vector3 __smoothGoToDestination_"+n.id+" = "+destination+";",p+"    float __smoothGoToMaxDistance_"+n.id+" = Mathf.Max(0f, "+maxDistance+");",p+"    Vector3 __smoothGoToOffset_"+n.id+" = __smoothGoToDestination_"+n.id+" - "+target+".transform.position;",p+"    float __smoothGoToRemaining_"+n.id+" = __smoothGoToOffset_"+n.id+".magnitude;",p+"    if (__smoothGoToRemaining_"+n.id+" > 0f) "+target+".transform.position += __smoothGoToOffset_"+n.id+" / __smoothGoToRemaining_"+n.id+" * Mathf.Min(__smoothGoToMaxDistance_"+n.id+", __smoothGoToRemaining_"+n.id+");",p+"}");
   }else if(n.type==="transform"){
    const op=n.values?.operation||"setPosition",v3Link=dataLink(n.id,"vector"),quaternionLink=dataLink(n.id,"quaternion"),targetLink=dataLink(n.id,"target");
    if(!targetLink){valueForInput(n,"target",new Set(),"GameObject");}
    else{
     const target=valueExpr(targetLink.from,new Set(),"GameObject",targetLink.fromPin),transform=target+".transform";
     const v=valueForInput(n,"vector",new Set(),"Vector3"),quaternion=valueForInput(n,"quaternion",new Set(),"Quaternion");
     const rotationValue=quaternionLink?quaternion:"Quaternion.Euler("+v+")";
     const rotateFactor=(n.values?.rotationRate||"time")==="time"?" * Time.deltaTime":"";const rotateSpace=n.values?.rotateSpace==="self"?"Space.Self":"Space.World";const code={setPosition:transform+".position = "+v+";",translate:transform+".Translate("+v+" * Time.deltaTime);",rotate:transform+".Rotate("+v+rotateFactor+", "+rotateSpace+");",setRotation:transform+".rotation = "+rotationValue+";",setScale:transform+".localScale = "+v+";"};
     if(op==="setRotation"&&!quaternionLink&&!v3Link)report("Connect a Vector3 or Quaternion input to Set Rotation.");
     if(code[op])out.push(p+"if ("+target+" != null) "+code[op]);
    }
   }else if(n.type==="gameobject"){
    const target=valueForInput(n,"target",new Set(),"GameObject"),op=n.values?.operation||"setActive";
    if(op==="destroy")out.push(p+"if ("+target+" != null) Destroy("+target+");");
    else if(op==="instantiate"){
     const posLink=dataLink(n.id,"position"),rotLink=dataLink(n.id,"rotation"),spawnArgs=posLink||rotLink?", "+valueForInput(n,"position",new Set(),"Vector3")+", "+valueForInput(n,"rotation",new Set(),"Quaternion"):"";
     if(outputConnected(n.id))out.push(p+(spawnedNames.get(n.id)||("__blueprintSpawned_"+n.id))+" = Instantiate("+target+spawnArgs+");");
     else out.push(p+"Instantiate("+target+spawnArgs+");");
    }else out.push(p+"if ("+target+" != null) "+target+".SetActive("+(n.values?.active==="false"?"false":"true")+");");
   }else if(n.type==="wait"){
    const flag=waitFlagNames.get(n.id)||("__blueprintWaitRunning_"+n.id),method=waitMethodNames.get(n.id)||("__blueprintWait_"+n.id);
    if(!generatedWaits.has(n.id)){
     generatedWaits.add(n.id);
     classFields.push("    private bool "+flag+";");
     extraMethods.push("    private IEnumerator "+method+"()","    {","        "+flag+" = true;","        yield return new WaitForSeconds(Mathf.Max(0f, "+cleanNumber(n.values?.seconds??"1","float")+"));");
     const next=connected(n.id,"Then");
     if(next)extraMethods.push(...emitFlow(next,2,new Set(visited)));
     extraMethods.push("        "+flag+" = false;","    }","");
    }
    out.push(p+"if (!"+flag+") StartCoroutine("+method+"());");
    break;
   }else if(n.type==="if"&&(n.values?.branchMode||"Exec")==="Exec"){
    const cond=valueForInput(n,"condition",new Set(),"bool");
    out.push(p+"if ("+cond+")",p+"{");
    const t=connected(n.id,"True");if(t)out.push(...emitFlow(t,indent+1,new Set(visited)));
    out.push(p+"}",p+"else",p+"{");
    const f=connected(n.id,"False");if(f)out.push(...emitFlow(f,indent+1,new Set(visited)));
    out.push(p+"}");
    break;
   }
   current=connected(current,"Then");
  }
  return out;
 }
 for(const n of nodes){
  if(n.type==="gameobject"&&(n.values?.operation||"setActive")==="instantiate"&&outputConnected(n.id))classFields.push("    private GameObject "+(spawnedNames.get(n.id)||("__blueprintSpawned_"+n.id))+";");
  if(n.type==="getvar"&&!findVar(n.values?.variable))report("Choose an existing variable in Get Variable.");
  if(n.type==="setvar"&&!findVar(n.values?.variable))report("Choose an existing variable in Set Variable.");
  if(n.type==="wait"&&(!Number.isFinite(Number(n.values?.seconds??1))||Number(n.values?.seconds??1)<0))report("Wait seconds should be a non-negative number.");
  if(n.type==="input")report("Input Check uses Unity's classic Input API. Set Active Input Handling to Input Manager (Old) or Both.");
  if(n.type==="compare"&&n.values?.operandType==="bool"&&["gt","lt","gte","lte"].includes(n.values?.operation))report("Boolean comparison supports only Equal and Not equal.");
 }
 for(const v of vars){
  const name=varsById.get(v.id)?.codeName||safeIdentifier(v.name,"Variable",usedNames),type=String(v.type||"int"),initial=variableInitializer(v);
  if(v.access==="public-hidden")classFields.push("    public "+type+" "+name+" { get; set; } = "+initial+";");
  else if(v.access==="public-inspector")classFields.push("    public "+type+" "+name+" = "+initial+";");
  else if(v.access==="private-inspector")classFields.push("    [SerializeField] private "+type+" "+name+" = "+initial+";");
  else classFields.push("    private "+type+" "+name+" = "+initial+";");
 }
 const eventKinds=[["awake","Awake",""],["start","Start",""],["onenable","OnEnable",""],["update","Update",""],["fixed","FixedUpdate",""],["ondisable","OnDisable",""],["ondestroy","OnDestroy",""],["triggerenter","OnTriggerEnter","Collider other"],["triggerstay","OnTriggerStay","Collider other"],["triggerexit","OnTriggerExit","Collider other"],["collisionenter","OnCollisionEnter","Collision collision"],["collisionstay","OnCollisionStay","Collision collision"],["collisionexit","OnCollisionExit","Collision collision"]];
 const debugDrawNodes=nodes.filter(n=>n.type==="raycast"||(["spherecast","overlapsphere"].includes(n.type)&&(!!dataLink(n.id,"showDebug")||n.values?.showDebug===true||n.values?.showDebug==="true")));
 for(const [type,method,signature] of eventKinds){
  const events=nodes.filter(n=>n.type===type);
  if(!events.length)continue;
  methods.push("    private void "+method+"("+signature+")","    {");
  for(const ev of events){
   if(type==="update"){
    for(const dn of debugDrawNodes){
     const linked=!!dataLink(dn.id,"showDebug");
     const enabled=linked?valueForInput(dn,"showDebug",new Set([dn.id]),"bool"):(dn.values?.showDebug===true||dn.values?.showDebug==="true"?"true":"false");
     if(dn.type==="raycast"){
      const origin=valueForInput(dn,"origin",new Set([dn.id]),"Vector3"),direction=valueForInput(dn,"direction",new Set([dn.id]),"Vector3"),distance=cleanNumber(dn.values?.maxDistance??"100","float");
      methods.push("        Vector3 __debugOrigin_"+dn.id+" = "+origin+";","        Vector3 __debugDirection_"+dn.id+" = "+direction+";","        float __debugDistance_"+dn.id+" = "+distance+";");
      methods.push("        if ("+enabled+") Debug.DrawRay(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", Color.yellow, 0f);","        RaycastHit __debugHit_"+dn.id+";","        Physics.Raycast(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+", out __debugHit_"+dn.id+", __debugDistance_"+dn.id+");");
     }else if(dn.type==="spherecast"){
      const origin=valueForInput(dn,"origin",new Set([dn.id]),"Vector3"),direction=valueForInput(dn,"direction",new Set([dn.id]),"Vector3"),distance=cleanNumber(dn.values?.maxDistance??"10","float"),radius=cleanNumber(dn.values?.radius??"0.5","float");
      methods.push("        Vector3 __debugOrigin_"+dn.id+" = "+origin+";","        Vector3 __debugDirection_"+dn.id+" = "+direction+";","        float __debugDistance_"+dn.id+" = "+distance+";");
      methods.push("        if ("+enabled+") { Debug.DrawRay(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", Color.yellow, 0f); __BlueprintDrawWireSphere(__debugOrigin_"+dn.id+", "+radius+", Color.cyan); __BlueprintDrawWireSphere(__debugOrigin_"+dn.id+" + __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", "+radius+", Color.cyan); }","        RaycastHit __debugHit_"+dn.id+";","        Physics.SphereCast(__debugOrigin_"+dn.id+", "+radius+", __debugDirection_"+dn.id+", out __debugHit_"+dn.id+", __debugDistance_"+dn.id+");");
     }else{
      const center=valueForInput(dn,"center",new Set([dn.id]),"Vector3"),radius=cleanNumber(dn.values?.radius??"1","float");
      methods.push("        Vector3 __debugCenter_"+dn.id+" = "+center+";","        if ("+enabled+") __BlueprintDrawWireSphere(__debugCenter_"+dn.id+", "+radius+", Color.green);","        Physics.OverlapSphere(__debugCenter_"+dn.id+", "+radius+");");
     }
    }
   }

   if(["triggerenter","triggerstay","triggerexit"].includes(type)){
    const show=dataLink(ev.id,"showDebug")?valueForInput(ev,"showDebug",new Set([ev.id]),"bool"):(ev.values?.showDebug===true||ev.values?.showDebug==="true"?"true":"false");
    methods.push("        if ("+show+")","        {","            Collider[] __blueprintOwnColliders = GetComponents<Collider>();","            foreach (Collider __blueprintCollider in __blueprintOwnColliders)","                if (__blueprintCollider != null) __BlueprintDrawBounds(__blueprintCollider.bounds, Color.magenta);","            if (other != null) __BlueprintDrawBounds(other.bounds, Color.yellow);","        }");
   }
   const next=connected(ev.id,"Then");
   if(next)methods.push(...emitFlow(next,2,new Set([ev.id])));
  }
  methods.push("    }","");
 }
 if(debugDrawNodes.length&&!nodes.some(n=>n.type==="update")){
  methods.push("    private void Update()","    {");
  for(const dn of debugDrawNodes){
     const linked=!!dataLink(dn.id,"showDebug");
     const enabled=linked?valueForInput(dn,"showDebug",new Set([dn.id]),"bool"):(dn.values?.showDebug===true||dn.values?.showDebug==="true"?"true":"false");
     if(dn.type==="raycast"){
      const origin=valueForInput(dn,"origin",new Set([dn.id]),"Vector3"),direction=valueForInput(dn,"direction",new Set([dn.id]),"Vector3"),distance=cleanNumber(dn.values?.maxDistance??"100","float");
      methods.push("        Vector3 __debugOrigin_"+dn.id+" = "+origin+";","        Vector3 __debugDirection_"+dn.id+" = "+direction+";","        float __debugDistance_"+dn.id+" = "+distance+";");
      methods.push("        if ("+enabled+") Debug.DrawRay(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", Color.yellow, 0f);","        RaycastHit __debugHit_"+dn.id+";","        Physics.Raycast(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+", out __debugHit_"+dn.id+", __debugDistance_"+dn.id+");");
     }else if(dn.type==="spherecast"){
      const origin=valueForInput(dn,"origin",new Set([dn.id]),"Vector3"),direction=valueForInput(dn,"direction",new Set([dn.id]),"Vector3"),distance=cleanNumber(dn.values?.maxDistance??"10","float"),radius=cleanNumber(dn.values?.radius??"0.5","float");
      methods.push("        Vector3 __debugOrigin_"+dn.id+" = "+origin+";","        Vector3 __debugDirection_"+dn.id+" = "+direction+";","        float __debugDistance_"+dn.id+" = "+distance+";");
      methods.push("        if ("+enabled+") { Debug.DrawRay(__debugOrigin_"+dn.id+", __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", Color.yellow, 0f); __BlueprintDrawWireSphere(__debugOrigin_"+dn.id+", "+radius+", Color.cyan); __BlueprintDrawWireSphere(__debugOrigin_"+dn.id+" + __debugDirection_"+dn.id+".normalized * __debugDistance_"+dn.id+", "+radius+", Color.cyan); }","        RaycastHit __debugHit_"+dn.id+";","        Physics.SphereCast(__debugOrigin_"+dn.id+", "+radius+", __debugDirection_"+dn.id+", out __debugHit_"+dn.id+", __debugDistance_"+dn.id+");");
     }else{
      const center=valueForInput(dn,"center",new Set([dn.id]),"Vector3"),radius=cleanNumber(dn.values?.radius??"1","float");
      methods.push("        Vector3 __debugCenter_"+dn.id+" = "+center+";","        if ("+enabled+") __BlueprintDrawWireSphere(__debugCenter_"+dn.id+", "+radius+", Color.green);","        Physics.OverlapSphere(__debugCenter_"+dn.id+", "+radius+");");
     }
    }
  methods.push("    }","");
 }
 if(!eventKinds.some(([type])=>nodes.some(n=>n.type===type))){
  report("Add On Start, On Update, or On Fixed Update so the generated script has an entry point.");
  methods.push("    private void Start()","    {","    }","");
 }
 const functionNodes=nodes.filter(n=>n.type==="functionstart");
 functionNodes.forEach(fn=>{
  const method=safeIdentifier(fn.values?.name||"MyFunction","MyFunction",new Set())+"_"+fn.id;
  methods.push("    private void "+method+"()","    {");
  const next=connected(fn.id,"Then");
  if(next)methods.push(...emitFlow(next,2,new Set([fn.id])));
  methods.push("    }","");
 });
 if(extraMethods.length)methods.push(...extraMethods);
 const visualPhysicsNodes=nodes.some(n=>["raycast","spherecast","overlapsphere"].includes(n.type)&&(!!dataLink(n.id,"showDebug")||n.values?.showDebug===true||n.values?.showDebug==="true"));
 const visualTriggerNodes=nodes.some(n=>["triggerenter","triggerstay","triggerexit"].includes(n.type));
 if(visualPhysicsNodes)methods.push("    private void __BlueprintDrawWireSphere(Vector3 center, float radius, Color color)","    {","        const int segments = 24;","        float step = 360f / segments;","        for (int i = 0; i < segments; i++)","        {","            float a = i * step * Mathf.Deg2Rad;","            float b = (i + 1) * step * Mathf.Deg2Rad;","            float ax = Mathf.Cos(a) * radius;","            float ay = Mathf.Sin(a) * radius;","            float bx = Mathf.Cos(b) * radius;","            float by = Mathf.Sin(b) * radius;","            Debug.DrawLine(center + new Vector3(ax, ay, 0f), center + new Vector3(bx, by, 0f), color, 0.1f);","            Debug.DrawLine(center + new Vector3(ax, 0f, ay), center + new Vector3(bx, 0f, by), color, 0.1f);","            Debug.DrawLine(center + new Vector3(0f, ax, ay), center + new Vector3(0f, bx, by), color, 0.1f);","        }","    }","");
 if(visualTriggerNodes)methods.push("    private void __BlueprintDrawBounds(Bounds bounds, Color color)","    {","        Vector3 c = bounds.center;","        Vector3 e = bounds.extents;","        Vector3 p0 = c + new Vector3(-e.x, -e.y, -e.z);","        Vector3 p1 = c + new Vector3(e.x, -e.y, -e.z);","        Vector3 p2 = c + new Vector3(e.x, -e.y, e.z);","        Vector3 p3 = c + new Vector3(-e.x, -e.y, e.z);","        Vector3 p4 = c + new Vector3(-e.x, e.y, -e.z);","        Vector3 p5 = c + new Vector3(e.x, e.y, -e.z);","        Vector3 p6 = c + new Vector3(e.x, e.y, e.z);","        Vector3 p7 = c + new Vector3(-e.x, e.y, e.z);","        Debug.DrawLine(p0,p1,color,0.1f); Debug.DrawLine(p1,p2,color,0.1f); Debug.DrawLine(p2,p3,color,0.1f); Debug.DrawLine(p3,p0,color,0.1f);","        Debug.DrawLine(p4,p5,color,0.1f); Debug.DrawLine(p5,p6,color,0.1f); Debug.DrawLine(p6,p7,color,0.1f); Debug.DrawLine(p7,p4,color,0.1f);","        Debug.DrawLine(p0,p4,color,0.1f); Debug.DrawLine(p1,p5,color,0.1f); Debug.DrawLine(p2,p6,color,0.1f); Debug.DrawLine(p3,p7,color,0.1f);","    }","");
 const referencedTypes=[...vars.map(v=>String(v.type||"")), ...nodes.map(n=>String(n.values?.componentType||"")), ...nodes.map(n=>String(n.values?.property||"")), ...nodes.filter(n=>n.type==="setcomponent").map(n=>propertyType(n.values?.componentType||"HingeJoint",n.values?.property||"limits"))];
 const hasType=(...types)=>referencedTypes.some(t=>types.includes(t));
 const imports=["using UnityEngine;","using System;","using System.Collections;","using System.Collections.Generic;"];
 if(hasType("Button","Toggle","Slider","Scrollbar","Dropdown","TMP_Dropdown","TMP_InputField","InputField","Image","RawImage","Text","GridLayoutGroup","VerticalLayoutGroup","HorizontalLayoutGroup","ContentSizeFitter","LayoutElement","ScrollRect","RectMask2D","Mask","AspectRatioFitter","GraphicRaycaster"))imports.push("using UnityEngine.UI;");
 if(referencedTypes.some(t=>t.startsWith("TMP_")||t==="TextMeshPro"||t==="TextMeshProUGUI"))imports.push("using TMPro;");
 if(hasType("NavMeshAgent","NavMeshObstacle"))imports.push("using UnityEngine.AI;");
 if(hasType("NavMeshSurface"))imports.push("using Unity.AI.Navigation;");
 if(hasType("VideoPlayer"))imports.push("using UnityEngine.Video;");
 if(hasType("PlayableDirector"))imports.push("using UnityEngine.Playables;");
 if(hasType("Volume","VolumeProfile","RenderPipelineAsset","VolumeComponent","VolumeParameter","ShadowCastingMode"))imports.push("using UnityEngine.Rendering;");
 if(hasType("PostProcessVolume","PostProcessProfile","PostProcessLayer"))imports.push("using UnityEngine.Rendering.PostProcessing;");
 if(hasType("EventSystem","PointerEventData","BaseEventData"))imports.push("using UnityEngine.EventSystems;");
 const dependencyDiagnostics=[
  {types:["TMP_Text","TMP_InputField","TMP_Dropdown","TextMeshPro","TextMeshProUGUI"],message:"This script uses TextMeshPro types. Install the TextMeshPro package in the Unity project."},
  {types:["NavMeshSurface"],message:"This script uses NavMeshSurface. Install the AI Navigation package in the Unity project."},
  {types:["PostProcessVolume","PostProcessProfile","PostProcessLayer"],message:"This script uses Post Processing types. Install the matching Post Processing package in the Unity project."},
  {types:["NetworkBehaviour"],message:"NetworkBehaviour needs a networking package and its correct namespace; that cannot be inferred safely from the node alone."}
 ];
 for(const dependency of dependencyDiagnostics)if(hasType(...dependency.types))report(dependency.message);
 const declaration=imports.concat(["","public class "+safeClass+" : MonoBehaviour","{"]);
 const fields=classFields.length?classFields.concat([""]):[];
 const code=declaration.concat(fields,methods,["}"]).join("\n");
 return {code,diagnostics:[...new Set(diagnostics)]};
}
return {compile};
})();