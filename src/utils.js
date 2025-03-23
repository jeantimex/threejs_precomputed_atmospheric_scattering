/*
<p>The <code>Utils</code> class used above provides 4 methods, to load shader
and texture data using XML http requests, and to create WebGL shader and
texture objects from them:
*/

export class Utils {

  static loadShaderSource(shaderName, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/public/${shaderName}`);
    xhr.responseType = 'text';
    xhr.onload = (event) => callback(xhr.responseText.trim());
    xhr.send();
  }

  static createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  static loadTextureData(textureName, callback) {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `/public/${textureName}`);
    xhr.responseType = 'arraybuffer';
    xhr.onload = (event) => {
      const data = new DataView(xhr.response);
      const array =
          new Float32Array(data.byteLength / Float32Array.BYTES_PER_ELEMENT);
      for (var i = 0; i < array.length; ++i) {
        array[i] = data.getFloat32(i * Float32Array.BYTES_PER_ELEMENT, true);
      }
      callback(array);
    };
    xhr.send();
  }

  static createTexture(gl, textureUnit, target) {
    const texture = gl.createTexture();
    gl.activeTexture(textureUnit);
    gl.bindTexture(target, texture);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }
}