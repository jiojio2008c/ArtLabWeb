import { RIPPLE_DURATION_MS } from './interaction-core.js'

export const MAX_WATER_RIPPLES = 4

export const WATER_RIPPLE_LIGHTING_PROFILE = Object.freeze({
  displacementStrengthPixels: 9,
  maxDisplacementPixels: 14.5,
  crestHighlightStrength: 0.115,
  waveHighlightStrength: 0.026,
  shadowStrength: 0.065,
  impactHighlightStrength: 0.15
})

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
attribute vec2 a_texCoord;

varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`

const FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_stageSize;
uniform vec4 u_ripples[${MAX_WATER_RIPPLES}];

varying vec2 v_texCoord;

void main() {
  vec2 displacementPixels = vec2(0.0);
  float highlight = 0.0;
  float shadow = 0.0;
  float impactHighlight = 0.0;

  for (int index = 0; index < ${MAX_WATER_RIPPLES}; index += 1) {
    vec4 ripple = u_ripples[index];
    if (ripple.w <= 0.0) continue;

    vec2 deltaPixels = (v_texCoord - ripple.xy) * u_stageSize;
    float distanceToCenter = length(deltaPixels);
    vec2 radialDirection = distanceToCenter > 0.001
      ? deltaPixels / distanceToCenter
      : vec2(0.0);

    float progress = clamp(ripple.z, 0.0, 1.0);
    float radius = 10.0 + progress * 430.0;
    float distanceFromFront = distanceToCenter - radius;
    float frontGate = 1.0 - smoothstep(3.0, 22.0, distanceFromFront);
    float centerGate = smoothstep(5.0, 34.0, distanceToCenter);
    float trailingEnvelope = exp(-abs(distanceFromFront) * 0.018);
    float lifeEnvelope = pow(1.0 - progress, 1.12);
    float envelope = frontGate * centerGate * trailingEnvelope * lifeEnvelope * ripple.w;
    float phase = distanceFromFront * 0.13;
    float wave = sin(phase) * envelope;
    float slope = cos(phase) * envelope;

    displacementPixels += radialDirection * slope * ${WATER_RIPPLE_LIGHTING_PROFILE.displacementStrengthPixels.toFixed(1)};
    highlight += max(slope, 0.0) * ${WATER_RIPPLE_LIGHTING_PROFILE.crestHighlightStrength.toFixed(3)}
      + max(wave, 0.0) * ${WATER_RIPPLE_LIGHTING_PROFILE.waveHighlightStrength.toFixed(3)};
    shadow += max(-slope, 0.0) * ${WATER_RIPPLE_LIGHTING_PROFILE.shadowStrength.toFixed(3)};
    impactHighlight += exp(-distanceToCenter * 0.034)
      * exp(-progress * 11.0)
      * ripple.w
      * ${WATER_RIPPLE_LIGHTING_PROFILE.impactHighlightStrength.toFixed(3)};
  }

  float displacementLength = length(displacementPixels);
  if (displacementLength > ${WATER_RIPPLE_LIGHTING_PROFILE.maxDisplacementPixels.toFixed(1)}) {
    displacementPixels *= ${WATER_RIPPLE_LIGHTING_PROFILE.maxDisplacementPixels.toFixed(1)} / displacementLength;
  }

  vec2 refractedUv = clamp(
    v_texCoord + displacementPixels / u_stageSize,
    vec2(0.001),
    vec2(0.999)
  );
  vec4 color = texture2D(u_texture, refractedUv);
  color.rgb += vec3(0.72, 0.91, 1.0) * (highlight + impactHighlight);
  color.rgb -= vec3(0.16, 0.25, 0.31) * shadow;
  gl_FragColor = vec4(clamp(color.rgb, 0.0, 1.0), 1.0);
}
`

const createShader = (gl, type, source) => {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error'
    gl.deleteShader(shader)
    throw new Error(info)
  }

  return shader
}

const createProgram = (gl) => {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
  const program = gl.createProgram()
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown shader link error'
    gl.deleteProgram(program)
    throw new Error(info)
  }

  return program
}

export const createWaterRippleRenderer = (canvas) => {
  let gl = null
  let program = null
  let texture = null
  let textureReady = false
  let lastTextureKey = ''
  let failed = false

  const rippleUniformData = new Float32Array(MAX_WATER_RIPPLES * 4)
  let stageSizeLocation = null
  let ripplesLocation = null

  try {
    gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance'
    })
    if (!gl) throw new Error('WebGL is not available')

    program = createProgram(gl)
    const vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      1, 1, 1, 1
    ]), gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, 'a_position')
    const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8)

    texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

    gl.useProgram(program)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)
    stageSizeLocation = gl.getUniformLocation(program, 'u_stageSize')
    ripplesLocation = gl.getUniformLocation(program, 'u_ripples[0]')
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
  } catch (error) {
    failed = true
    console.warn('Water ripple renderer is unavailable:', error)
  }

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    failed = true
    console.warn('Water ripple renderer lost its WebGL context')
  })

  const uploadTexture = (sourceCanvas, textureKey, textureIsDynamic) => {
    if (textureReady && !textureIsDynamic && textureKey === lastTextureKey) return

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (textureReady) {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        sourceCanvas
      )
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        sourceCanvas
      )
      textureReady = true
    }
    lastTextureKey = textureKey
  }

  const render = ({
    sourceCanvas,
    textureKey,
    textureIsDynamic,
    ripples,
    now,
    stageWidth,
    stageHeight,
    viewport
  }) => {
    if (failed || !gl || !program) return false

    try {
      uploadTexture(sourceCanvas, textureKey, textureIsDynamic)

      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0.0196, 0.0275, 0.0392, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)

      const viewportX = Math.max(0, Math.round(viewport.x))
      const viewportWidth = Math.max(1, Math.round(viewport.width))
      const viewportHeight = Math.max(1, Math.round(viewport.height))
      const viewportY = Math.max(
        0,
        canvas.height - Math.round(viewport.y) - viewportHeight
      )
      gl.viewport(viewportX, viewportY, viewportWidth, viewportHeight)
      gl.useProgram(program)
      gl.uniform2f(stageSizeLocation, stageWidth, stageHeight)

      rippleUniformData.fill(0)
      ripples.slice(-MAX_WATER_RIPPLES).forEach((ripple, index) => {
        const progress = (now - ripple.startedAt) / RIPPLE_DURATION_MS
        if (progress < 0 || progress >= 1) return

        const offset = index * 4
        rippleUniformData[offset] = ripple.x / stageWidth
        rippleUniformData[offset + 1] = 1 - ripple.y / stageHeight
        rippleUniformData[offset + 2] = progress
        rippleUniformData[offset + 3] = 1
      })
      gl.uniform4fv(ripplesLocation, rippleUniformData)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return true
    } catch (error) {
      failed = true
      console.warn('Water ripple rendering failed; using the 2D fallback:', error)
      return false
    }
  }

  return {
    render,
    resetTexture() {
      textureReady = false
      lastTextureKey = ''
    },
    get available() {
      return !failed && Boolean(gl && program)
    }
  }
}
