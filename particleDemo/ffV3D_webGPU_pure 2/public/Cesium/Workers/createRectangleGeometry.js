define(["./defaultValue-f6d5e6da","./Matrix3-81054f0f","./Matrix2-413c4048","./Transforms-fce95115","./ComponentDatatype-ab629b88","./GeometryAttribute-81ff775c","./GeometryAttributes-1e4ddcd2","./GeometryInstance-0318e0cd","./GeometryOffsetAttribute-2579b8d2","./GeometryPipeline-e049e700","./IndexDatatype-d3db4e7d","./Math-2ce22ee9","./PolygonPipeline-61ca1579","./RectangleGeometryLibrary-a0a06d23","./VertexFormat-fbdec922","./RuntimeError-9b4ce3fb","./combine-0c102d93","./WebGLConstants-7f557f93","./AttributeCompression-48e336db","./EncodedCartesian3-5e2017ab","./IntersectionTests-357c3d7f","./Plane-6add0ae1","./EllipsoidRhumbLine-77eff028"],(function(t,e,n,a,o,r,i,s,l,u,c,m,p,g,d,y,f,h,b,_,A,x,w){"use strict";const C=new e.Cartesian3,v=new e.Cartesian3,R=new e.Cartesian3,E=new e.Cartesian3,G=new n.Rectangle,F=new n.Cartesian2,P=new a.BoundingSphere,V=new a.BoundingSphere;function L(t,e){const n=new r.Geometry({attributes:new i.GeometryAttributes,primitiveType:r.PrimitiveType.TRIANGLES});return n.attributes.position=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.DOUBLE,componentsPerAttribute:3,values:e.positions}),t.normal&&(n.attributes.normal=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:e.normals})),t.tangent&&(n.attributes.tangent=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:e.tangents})),t.bitangent&&(n.attributes.bitangent=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:e.bitangents})),n}const D=new e.Cartesian3,M=new e.Cartesian3;function T(t,n){const a=t._vertexFormat,i=t._ellipsoid,s=n.height,l=n.width,u=n.northCap,m=n.southCap;let p=0,d=s,y=s,f=0;u&&(p=1,y-=1,f+=1),m&&(d-=1,y-=1,f+=1),f+=l*y;const h=a.position?new Float64Array(3*f):void 0,b=a.st?new Float32Array(2*f):void 0;let _=0,A=0;const x=C,w=F;let G=Number.MAX_VALUE,P=Number.MAX_VALUE,V=-Number.MAX_VALUE,D=-Number.MAX_VALUE;for(let t=p;t<d;++t)for(let e=0;e<l;++e)g.RectangleGeometryLibrary.computePosition(n,i,a.st,t,e,x,w),h[_++]=x.x,h[_++]=x.y,h[_++]=x.z,a.st&&(b[A++]=w.x,b[A++]=w.y,G=Math.min(G,w.x),P=Math.min(P,w.y),V=Math.max(V,w.x),D=Math.max(D,w.y));if(u&&(g.RectangleGeometryLibrary.computePosition(n,i,a.st,0,0,x,w),h[_++]=x.x,h[_++]=x.y,h[_++]=x.z,a.st&&(b[A++]=w.x,b[A++]=w.y,G=w.x,P=w.y,V=w.x,D=w.y)),m&&(g.RectangleGeometryLibrary.computePosition(n,i,a.st,s-1,0,x,w),h[_++]=x.x,h[_++]=x.y,h[_]=x.z,a.st&&(b[A++]=w.x,b[A]=w.y,G=Math.min(G,w.x),P=Math.min(P,w.y),V=Math.max(V,w.x),D=Math.max(D,w.y))),a.st&&(G<0||P<0||V>1||D>1))for(let t=0;t<b.length;t+=2)b[t]=(b[t]-G)/(V-G),b[t+1]=(b[t+1]-P)/(D-P);const M=function(t,n,a,o){const r=t.length,i=n.normal?new Float32Array(r):void 0,s=n.tangent?new Float32Array(r):void 0,l=n.bitangent?new Float32Array(r):void 0;let u=0;const c=E,m=R;let p=v;if(n.normal||n.tangent||n.bitangent)for(let g=0;g<r;g+=3){const r=e.Cartesian3.fromArray(t,g,C),d=u+1,y=u+2;p=a.geodeticSurfaceNormal(r,p),(n.tangent||n.bitangent)&&(e.Cartesian3.cross(e.Cartesian3.UNIT_Z,p,m),e.Matrix3.multiplyByVector(o,m,m),e.Cartesian3.normalize(m,m),n.bitangent&&e.Cartesian3.normalize(e.Cartesian3.cross(p,m,c),c)),n.normal&&(i[u]=p.x,i[d]=p.y,i[y]=p.z),n.tangent&&(s[u]=m.x,s[d]=m.y,s[y]=m.z),n.bitangent&&(l[u]=c.x,l[d]=c.y,l[y]=c.z),u+=3}return L(n,{positions:t,normals:i,tangents:s,bitangents:l})}(h,a,i,n.tangentRotationMatrix);let T=6*(l-1)*(y-1);u&&(T+=3*(l-1)),m&&(T+=3*(l-1));const O=c.IndexDatatype.createTypedArray(f,T);let N,S=0,I=0;for(N=0;N<y-1;++N){for(let t=0;t<l-1;++t){const t=S,e=t+l,n=e+1,a=t+1;O[I++]=t,O[I++]=e,O[I++]=a,O[I++]=a,O[I++]=e,O[I++]=n,++S}++S}if(u||m){let t=f-1;const e=f-1;let n,a;if(u&&m&&(t=f-2),S=0,u)for(N=0;N<l-1;N++)n=S,a=n+1,O[I++]=t,O[I++]=n,O[I++]=a,++S;if(m)for(S=(y-1)*l,N=0;N<l-1;N++)n=S,a=n+1,O[I++]=n,O[I++]=e,O[I++]=a,++S}return M.indices=O,a.st&&(M.attributes.st=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:b})),M}function O(t,e,n,a,o){return t[e++]=a[n],t[e++]=a[n+1],t[e++]=a[n+2],t[e++]=o[n],t[e++]=o[n+1],t[e]=o[n+2],t}function N(t,e,n,a){return t[e++]=a[n],t[e++]=a[n+1],t[e++]=a[n],t[e]=a[n+1],t}const S=new d.VertexFormat;function I(n,a){const i=n._shadowVolume,g=n._offsetAttribute,y=n._vertexFormat,f=n._extrudedHeight,h=n._surfaceHeight,b=n._ellipsoid,_=a.height,A=a.width;let x;if(i){const t=d.VertexFormat.clone(y,S);t.normal=!0,n._vertexFormat=t}const w=T(n,a);i&&(n._vertexFormat=y);let G=p.PolygonPipeline.scaleToGeodeticHeight(w.attributes.position.values,h,b,!1);G=new Float64Array(G);let F=G.length;const P=2*F,V=new Float64Array(P);V.set(G);const I=p.PolygonPipeline.scaleToGeodeticHeight(w.attributes.position.values,f,b);V.set(I,F),w.attributes.position.values=V;const k=y.normal?new Float32Array(P):void 0,H=y.tangent?new Float32Array(P):void 0,z=y.bitangent?new Float32Array(P):void 0,B=y.st?new Float32Array(P/3*2):void 0;let U,Y,q;if(y.normal){for(Y=w.attributes.normal.values,k.set(Y),x=0;x<F;x++)Y[x]=-Y[x];k.set(Y,F),w.attributes.normal.values=k}if(i){Y=w.attributes.normal.values,y.normal||(w.attributes.normal=void 0);const t=new Float32Array(P);for(x=0;x<F;x++)Y[x]=-Y[x];t.set(Y,F),w.attributes.extrudeDirection=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:t})}const X=t.defined(g);if(X){const t=F/3*2;let e=new Uint8Array(t);g===l.GeometryOffsetAttribute.TOP?e=e.fill(1,0,t/2):(q=g===l.GeometryOffsetAttribute.NONE?0:1,e=e.fill(q)),w.attributes.applyOffset=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.UNSIGNED_BYTE,componentsPerAttribute:1,values:e})}if(y.tangent){const t=w.attributes.tangent.values;for(H.set(t),x=0;x<F;x++)t[x]=-t[x];H.set(t,F),w.attributes.tangent.values=H}if(y.bitangent){const t=w.attributes.bitangent.values;z.set(t),z.set(t,F),w.attributes.bitangent.values=z}y.st&&(U=w.attributes.st.values,B.set(U),B.set(U,F/3*2),w.attributes.st.values=B);const Q=w.indices,W=Q.length,J=F/3,j=c.IndexDatatype.createTypedArray(P/3,2*W);for(j.set(Q),x=0;x<W;x+=3)j[x+W]=Q[x+2]+J,j[x+1+W]=Q[x+1]+J,j[x+2+W]=Q[x]+J;w.indices=j;const Z=a.northCap,K=a.southCap;let $=_,tt=2,et=0,nt=4,at=4;Z&&(tt-=1,$-=1,et+=1,nt-=2,at-=1),K&&(tt-=1,$-=1,et+=1,nt-=2,at-=1),et+=tt*A+2*$-nt;const ot=2*(et+at);let rt=new Float64Array(3*ot);const it=i?new Float32Array(3*ot):void 0;let st=X?new Uint8Array(ot):void 0,lt=y.st?new Float32Array(2*ot):void 0;const ut=g===l.GeometryOffsetAttribute.TOP;X&&!ut&&(q=g===l.GeometryOffsetAttribute.ALL?1:0,st=st.fill(q));let ct=0,mt=0,pt=0,gt=0;const dt=A*$;let yt;for(x=0;x<dt;x+=A)yt=3*x,rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*x,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1);if(K){const t=Z?dt+1:dt;for(yt=3*t,x=0;x<2;x++)rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*t,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1)}else for(x=dt-A;x<dt;x++)yt=3*x,rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*x,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1);for(x=dt-1;x>0;x-=A)yt=3*x,rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*x,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1);if(Z){const t=dt;for(yt=3*t,x=0;x<2;x++)rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*t,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1)}else for(x=A-1;x>=0;x--)yt=3*x,rt=O(rt,ct,yt,G,I),ct+=6,y.st&&(lt=N(lt,mt,2*x,U),mt+=4),i&&(pt+=3,it[pt++]=Y[yt],it[pt++]=Y[yt+1],it[pt++]=Y[yt+2]),ut&&(st[gt++]=1,gt+=1);let ft=function(t,n,a){const o=t.length,r=n.normal?new Float32Array(o):void 0,i=n.tangent?new Float32Array(o):void 0,s=n.bitangent?new Float32Array(o):void 0;let l=0,u=0,c=0,p=!0,g=E,d=R,y=v;if(n.normal||n.tangent||n.bitangent)for(let f=0;f<o;f+=6){const h=e.Cartesian3.fromArray(t,f,C),b=e.Cartesian3.fromArray(t,(f+6)%o,D);if(p){const n=e.Cartesian3.fromArray(t,(f+3)%o,M);e.Cartesian3.subtract(b,h,b),e.Cartesian3.subtract(n,h,n),y=e.Cartesian3.normalize(e.Cartesian3.cross(n,b,y),y),p=!1}e.Cartesian3.equalsEpsilon(b,h,m.CesiumMath.EPSILON10)&&(p=!0),(n.tangent||n.bitangent)&&(g=a.geodeticSurfaceNormal(h,g),n.tangent&&(d=e.Cartesian3.normalize(e.Cartesian3.cross(g,y,d),d))),n.normal&&(r[l++]=y.x,r[l++]=y.y,r[l++]=y.z,r[l++]=y.x,r[l++]=y.y,r[l++]=y.z),n.tangent&&(i[u++]=d.x,i[u++]=d.y,i[u++]=d.z,i[u++]=d.x,i[u++]=d.y,i[u++]=d.z),n.bitangent&&(s[c++]=g.x,s[c++]=g.y,s[c++]=g.z,s[c++]=g.x,s[c++]=g.y,s[c++]=g.z)}return L(n,{positions:t,normals:r,tangents:i,bitangents:s})}(rt,y,b);y.st&&(ft.attributes.st=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:2,values:lt})),i&&(ft.attributes.extrudeDirection=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.FLOAT,componentsPerAttribute:3,values:it})),X&&(ft.attributes.applyOffset=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.UNSIGNED_BYTE,componentsPerAttribute:1,values:st}));const ht=c.IndexDatatype.createTypedArray(ot,6*et);let bt,_t,At,xt;F=rt.length/3;let wt=0;for(x=0;x<F-1;x+=2){bt=x,xt=(bt+2)%F;const t=e.Cartesian3.fromArray(rt,3*bt,D),n=e.Cartesian3.fromArray(rt,3*xt,M);e.Cartesian3.equalsEpsilon(t,n,m.CesiumMath.EPSILON10)||(_t=(bt+1)%F,At=(_t+2)%F,ht[wt++]=bt,ht[wt++]=_t,ht[wt++]=xt,ht[wt++]=xt,ht[wt++]=_t,ht[wt++]=At)}return ft.indices=ht,ft=u.GeometryPipeline.combineInstances([new s.GeometryInstance({geometry:w}),new s.GeometryInstance({geometry:ft})]),ft[0]}const k=[new e.Cartesian3,new e.Cartesian3,new e.Cartesian3,new e.Cartesian3],H=new e.Cartographic,z=new e.Cartographic;function B(t,e,a,o,r){if(0===a)return n.Rectangle.clone(t,r);const i=g.RectangleGeometryLibrary.computeOptions(t,e,a,0,G,H),s=i.height,l=i.width,u=k;return g.RectangleGeometryLibrary.computePosition(i,o,!1,0,0,u[0]),g.RectangleGeometryLibrary.computePosition(i,o,!1,0,l-1,u[1]),g.RectangleGeometryLibrary.computePosition(i,o,!1,s-1,0,u[2]),g.RectangleGeometryLibrary.computePosition(i,o,!1,s-1,l-1,u[3]),n.Rectangle.fromCartesianArray(u,o,r)}function U(a){const o=(a=t.defaultValue(a,t.defaultValue.EMPTY_OBJECT)).rectangle,r=t.defaultValue(a.height,0),i=t.defaultValue(a.extrudedHeight,r);this._rectangle=n.Rectangle.clone(o),this._granularity=t.defaultValue(a.granularity,m.CesiumMath.RADIANS_PER_DEGREE),this._ellipsoid=e.Ellipsoid.clone(t.defaultValue(a.ellipsoid,e.Ellipsoid.WGS84)),this._surfaceHeight=Math.max(r,i),this._rotation=t.defaultValue(a.rotation,0),this._stRotation=t.defaultValue(a.stRotation,0),this._vertexFormat=d.VertexFormat.clone(t.defaultValue(a.vertexFormat,d.VertexFormat.DEFAULT)),this._extrudedHeight=Math.min(r,i),this._shadowVolume=t.defaultValue(a.shadowVolume,!1),this._workerName="createRectangleGeometry",this._offsetAttribute=a.offsetAttribute,this._rotatedRectangle=void 0,this._textureCoordinateRotationPoints=void 0}U.packedLength=n.Rectangle.packedLength+e.Ellipsoid.packedLength+d.VertexFormat.packedLength+7,U.pack=function(a,o,r){return r=t.defaultValue(r,0),n.Rectangle.pack(a._rectangle,o,r),r+=n.Rectangle.packedLength,e.Ellipsoid.pack(a._ellipsoid,o,r),r+=e.Ellipsoid.packedLength,d.VertexFormat.pack(a._vertexFormat,o,r),r+=d.VertexFormat.packedLength,o[r++]=a._granularity,o[r++]=a._surfaceHeight,o[r++]=a._rotation,o[r++]=a._stRotation,o[r++]=a._extrudedHeight,o[r++]=a._shadowVolume?1:0,o[r]=t.defaultValue(a._offsetAttribute,-1),o};const Y=new n.Rectangle,q=e.Ellipsoid.clone(e.Ellipsoid.UNIT_SPHERE),X={rectangle:Y,ellipsoid:q,vertexFormat:S,granularity:void 0,height:void 0,rotation:void 0,stRotation:void 0,extrudedHeight:void 0,shadowVolume:void 0,offsetAttribute:void 0};U.unpack=function(a,o,r){o=t.defaultValue(o,0);const i=n.Rectangle.unpack(a,o,Y);o+=n.Rectangle.packedLength;const s=e.Ellipsoid.unpack(a,o,q);o+=e.Ellipsoid.packedLength;const l=d.VertexFormat.unpack(a,o,S);o+=d.VertexFormat.packedLength;const u=a[o++],c=a[o++],m=a[o++],p=a[o++],g=a[o++],y=1===a[o++],f=a[o];return t.defined(r)?(r._rectangle=n.Rectangle.clone(i,r._rectangle),r._ellipsoid=e.Ellipsoid.clone(s,r._ellipsoid),r._vertexFormat=d.VertexFormat.clone(l,r._vertexFormat),r._granularity=u,r._surfaceHeight=c,r._rotation=m,r._stRotation=p,r._extrudedHeight=g,r._shadowVolume=y,r._offsetAttribute=-1===f?void 0:f,r):(X.granularity=u,X.height=c,X.rotation=m,X.stRotation=p,X.extrudedHeight=g,X.shadowVolume=y,X.offsetAttribute=-1===f?void 0:f,new U(X))},U.computeRectangle=function(n,a){const o=(n=t.defaultValue(n,t.defaultValue.EMPTY_OBJECT)).rectangle,r=t.defaultValue(n.granularity,m.CesiumMath.RADIANS_PER_DEGREE),i=t.defaultValue(n.ellipsoid,e.Ellipsoid.WGS84);return B(o,r,t.defaultValue(n.rotation,0),i,a)};const Q=new e.Matrix3,W=new a.Quaternion,J=new e.Cartographic;U.createGeometry=function(i){if(m.CesiumMath.equalsEpsilon(i._rectangle.north,i._rectangle.south,m.CesiumMath.EPSILON10)||m.CesiumMath.equalsEpsilon(i._rectangle.east,i._rectangle.west,m.CesiumMath.EPSILON10))return;let s=i._rectangle;const u=i._ellipsoid,c=i._rotation,d=i._stRotation,y=i._vertexFormat,f=g.RectangleGeometryLibrary.computeOptions(s,i._granularity,c,d,G,H,z),h=Q;if(0!==d||0!==c){const t=n.Rectangle.center(s,J),o=u.geodeticSurfaceNormalCartographic(t,D);a.Quaternion.fromAxisAngle(o,-d,W),e.Matrix3.fromQuaternion(W,h)}else e.Matrix3.clone(e.Matrix3.IDENTITY,h);const b=i._surfaceHeight,_=i._extrudedHeight,A=!m.CesiumMath.equalsEpsilon(b,_,0,m.CesiumMath.EPSILON2);let x,w;if(f.lonScalar=1/i._rectangle.width,f.latScalar=1/i._rectangle.height,f.tangentRotationMatrix=h,s=i._rectangle,A){x=I(i,f);const t=a.BoundingSphere.fromRectangle3D(s,u,b,V),e=a.BoundingSphere.fromRectangle3D(s,u,_,P);w=a.BoundingSphere.union(t,e)}else{if(x=T(i,f),x.attributes.position.values=p.PolygonPipeline.scaleToGeodeticHeight(x.attributes.position.values,b,u,!1),t.defined(i._offsetAttribute)){const t=x.attributes.position.values.length,e=i._offsetAttribute===l.GeometryOffsetAttribute.NONE?0:1,n=new Uint8Array(t/3).fill(e);x.attributes.applyOffset=new r.GeometryAttribute({componentDatatype:o.ComponentDatatype.UNSIGNED_BYTE,componentsPerAttribute:1,values:n})}w=a.BoundingSphere.fromRectangle3D(s,u,b)}return y.position||delete x.attributes.position,new r.Geometry({attributes:x.attributes,indices:x.indices,primitiveType:x.primitiveType,boundingSphere:w,offsetAttribute:i._offsetAttribute})},U.createShadowVolume=function(t,e,n){const a=t._granularity,o=t._ellipsoid,r=e(a,o),i=n(a,o);return new U({rectangle:t._rectangle,rotation:t._rotation,ellipsoid:o,stRotation:t._stRotation,granularity:a,extrudedHeight:i,height:r,vertexFormat:d.VertexFormat.POSITION_ONLY,shadowVolume:!0})};const j=new n.Rectangle,Z=[new n.Cartesian2,new n.Cartesian2,new n.Cartesian2],K=new n.Matrix2,$=new e.Cartographic;return Object.defineProperties(U.prototype,{rectangle:{get:function(){return t.defined(this._rotatedRectangle)||(this._rotatedRectangle=B(this._rectangle,this._granularity,this._rotation,this._ellipsoid)),this._rotatedRectangle}},textureCoordinateRotationPoints:{get:function(){return t.defined(this._textureCoordinateRotationPoints)||(this._textureCoordinateRotationPoints=function(t){if(0===t._stRotation)return[0,0,0,1,1,0];const e=n.Rectangle.clone(t._rectangle,j),a=t._granularity,o=t._ellipsoid,r=B(e,a,t._rotation-t._stRotation,o,j),i=Z;i[0].x=r.west,i[0].y=r.south,i[1].x=r.west,i[1].y=r.north,i[2].x=r.east,i[2].y=r.south;const s=t.rectangle,l=n.Matrix2.fromRotation(t._stRotation,K),u=n.Rectangle.center(s,$);for(let t=0;t<3;++t){const e=i[t];e.x-=u.longitude,e.y-=u.latitude,n.Matrix2.multiplyByVector(l,e,e),e.x+=u.longitude,e.y+=u.latitude,e.x=(e.x-s.west)/s.width,e.y=(e.y-s.south)/s.height}const c=i[0],m=i[1],p=i[2],g=new Array(6);return n.Cartesian2.pack(c,g),n.Cartesian2.pack(m,g,2),n.Cartesian2.pack(p,g,4),g}(this)),this._textureCoordinateRotationPoints}}}),function(a,o){return t.defined(o)&&(a=U.unpack(a,o)),a._ellipsoid=e.Ellipsoid.clone(a._ellipsoid),a._rectangle=n.Rectangle.clone(a._rectangle),U.createGeometry(a)}}));
