import * as THREE from 'three';

export interface ToonShaderUniforms {
  uBaseColor: { value: THREE.Color };
  uShadowColor: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  uRimPower: { value: number };
  uLightDirection: { value: THREE.Vector3 };
}

/**
 * createToonFresnelMaterial — Shader personalizado GLSL que combina bandas Toon escalonadas
 * con un contorno Fresnel Rim de marca para despegar la silueta del fondo.
 */
export function createToonFresnelMaterial(
  baseColorHex: string = '#00bcd4',
  rimColorHex: string = '#00f0ff'
): THREE.ShaderMaterial {
  const uniforms: ToonShaderUniforms = {
    uBaseColor: { value: new THREE.Color(baseColorHex) },
    uShadowColor: { value: new THREE.Color(baseColorHex).multiplyScalar(0.4) },
    uRimColor: { value: new THREE.Color(rimColorHex) },
    uRimPower: { value: 3.0 },
    uLightDirection: { value: new THREE.Vector3(0.5, 0.8, 0.5).normalize() },
  };

  const vertexShader = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = -mvPosition.xyz;
        gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform vec3 uBaseColor;
    uniform vec3 uShadowColor;
    uniform vec3 uRimColor;
    uniform float uRimPower;
    uniform vec3 uLightDirection;

    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        vec3 lightDir = normalize(uLightDirection);

        // 1. Difuso Toon escalonado con antialiasing
        float NdotL = dot(normal, lightDir);
        float stepLight = smoothstep(-0.02, 0.02, NdotL);
        vec3 diffuse = mix(uShadowColor, uBaseColor, stepLight);

        // 2. Fresnel Rim Light
        float NdotV = clamp(dot(normal, viewDir), 0.0, 1.0);
        float rimFactor = pow(1.0 - NdotV, uRimPower);
        rimFactor = smoothstep(0.4, 0.8, rimFactor);

        vec3 finalColor = diffuse + (uRimColor * rimFactor * 1.5);
        gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as { [uniform: string]: THREE.IUniform },
    vertexShader,
    fragmentShader,
  });
}
