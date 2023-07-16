import * as THREE from 'three'
import { INDEX_SIZE, createWebgpuVertexBuffer, degToRad } from '../utils'

const shaders = `
struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) uv : vec2f
}
@binding(0) @group(0) var<uniform> worldTransform : mat4x4<f32>;
@binding(1) @group(0) var<uniform> cameraWorldInverseTransform : mat4x4<f32>;
@binding(2) @group(0) var<uniform> projectionTransform : mat4x4<f32>;

@vertex
fn vertex_main(@location(0) position: vec3f,
               @location(1) uv: vec2f) -> VertexOut
{
  var output : VertexOut;
  output.position = projectionTransform * cameraWorldInverseTransform * worldTransform * vec4f(position, 1.0);
  output.uv = uv;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
  return vec4f(fragData.uv, 0.0, 1.0);
}
`;

interface App {
  state: {
    offset: [x: number, y: number],
    rotate: [x: number, y: number],
  };
  device: GPUDevice;
  canvasCtx: GPUCanvasContext;
  pipelines: {
    main: GPURenderPipeline,
  };
  vertexBuffers: {
    main: GPUBuffer,
    mainIndices: GPUBuffer,
  };
  uniformBuffers: {
    worldTransform: GPUBuffer,
    cameraWorldInverseTransform: GPUBuffer,
    projectionTransform: GPUBuffer,
  };
  uniformBindGroups: {
    main: GPUBindGroup,
  };
  renderPassDescriptor: GPURenderPassDescriptor;
}

const mainAttributeLocations: Record<string, number> = {
  position: 0,
  uv: 1,
}

export default async function main(canvas: HTMLCanvasElement) {
  const canvasCtx = canvas.getContext('webgpu');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return

  const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat()
  const device = await adapter.requestDevice();

  canvasCtx.configure({
    device: device,
    format: preferredCanvasFormat,
    alphaMode: "premultiplied",
  });

  const shaderModule = device.createShaderModule({
    code: shaders,
  });

  const mainVertexBuffer = createWebgpuVertexBuffer(
    new THREE.BoxGeometry(1, 1, 1),
    mainAttributeLocations,
  )

  const pipelines = {} as App['pipelines'];
  pipelines.main = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: [
        { // slot 0
          attributes: mainVertexBuffer.attrBufferLayout,
          arrayStride: mainVertexBuffer.attrBufferStride,
          stepMode: "vertex",
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fragment_main",
      targets: [
        {
          format: preferredCanvasFormat,
        },
      ],
    },
    primitive: {
      topology: "triangle-list",
      // cullMode: 'back',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
    layout: "auto",
  });

  // vertexData ===

  const vertexBuffers = {} as App['vertexBuffers'];
  vertexBuffers.main = device.createBuffer({
    size: mainVertexBuffer.vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffers.main.getMappedRange()).set(mainVertexBuffer.vertexData);
  vertexBuffers.main.unmap();

  vertexBuffers.mainIndices  = device.createBuffer({
    size: mainVertexBuffer.indices.byteLength,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  new Uint16Array(vertexBuffers.mainIndices .getMappedRange()).set(mainVertexBuffer.indices);
  vertexBuffers.mainIndices.unmap();

  // uniforms ===

  const uniformBuffers = {} as App['uniformBuffers'];
  uniformBuffers.worldTransform = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  uniformBuffers.cameraWorldInverseTransform = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  uniformBuffers.projectionTransform = device.createBuffer({
    size: 16 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroups = {} as App['uniformBindGroups'];
  uniformBindGroups.main = device.createBindGroup({
    layout: pipelines.main.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffers.worldTransform,
        },
      },
      {
        binding: 1,
        resource: {
          buffer: uniformBuffers.cameraWorldInverseTransform,
        },
      },
      {
        binding: 2,
        resource: {
          buffer: uniformBuffers.projectionTransform,
        },
      },
    ],
  });

  // textures ===

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  // ======

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
        view: canvasCtx.getCurrentTexture().createView(),
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),

      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  }

  const app: App = {
    state: {
      offset: [0, 0],
      rotate: [45, -45],
    },

    device, canvasCtx,
    pipelines,
    vertexBuffers, uniformBuffers,
    uniformBindGroups,
    renderPassDescriptor,
  };

  (window as any).app = app;
  console.log('window.app:', { app })
  updateCameraMatrix(app, 0.1, 1000, 45);
  render(app);

  document.body.addEventListener('keydown', (e) => {
    switch(e.key) {
      case 'a':
        app.state.offset[0] -= 0.1;
        render(app);
        break;
      case 'd':
        app.state.offset[0] += 0.1;
        render(app);
        break;
      case 's':
        app.state.offset[1] -= 0.1;
        render(app);
        break;
      case 'w':
        app.state.offset[1] += 0.1;
        render(app);
        break;
      case 'ArrowLeft':
        app.state.rotate[0] -= 2;
        render(app);
        break;
      case 'ArrowRight':
        app.state.rotate[0] += 2;
        render(app);
        break;
      case 'ArrowDown':
        app.state.rotate[1] -= 2;
        render(app);
        break;
      case 'ArrowUp':
        app.state.rotate[1] += 2;
        render(app);
        break;
    }
  });
}

function render(app: App) {
  const {
    state,

    device, canvasCtx, renderPassDescriptor,
    vertexBuffers, uniformBuffers, uniformBindGroups,
    pipelines,
  } = app;

  const worldTransform = new Float32Array(
    new THREE.Matrix4().makeTranslation(new THREE.Vector3(state.offset[0], state.offset[1], 0)).multiply(
      new THREE.Matrix4().makeRotationY(degToRad(state.rotate[0]))
    ).multiply(
      new THREE.Matrix4().makeRotationX(degToRad(-state.rotate[1]))
    ).toArray(),
  )
  device.queue.writeBuffer(
    uniformBuffers.worldTransform,
    0,
    worldTransform.buffer,
    worldTransform.byteOffset,
    worldTransform.byteLength,
  );

  const commandEncoder = device.createCommandEncoder();

  (renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = canvasCtx
    .getCurrentTexture()
    .createView();

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setPipeline(pipelines.main);
  passEncoder.setBindGroup(0, uniformBindGroups.main);
  passEncoder.setVertexBuffer(0, vertexBuffers.main);
  passEncoder.setIndexBuffer(vertexBuffers.mainIndices, "uint16");
  passEncoder.drawIndexed(vertexBuffers.mainIndices.size / INDEX_SIZE);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}

function updateCameraMatrix(app: App, near: number, far: number, fov: number) {
  const {
    // state,
    device, uniformBuffers, canvasCtx,
  } = app;

  const cameraWorldInverseTransform = new Float32Array(
    new THREE.Matrix4().makeTranslation(new THREE.Vector3(0, 0, 5)).invert().toArray()
  )
  device.queue.writeBuffer(
    uniformBuffers.cameraWorldInverseTransform,
    0,
    cameraWorldInverseTransform.buffer,
    cameraWorldInverseTransform.byteOffset,
    cameraWorldInverseTransform.byteLength,
  );

  const aspect = canvasCtx.canvas.width / canvasCtx.canvas.height;
  let top = near * Math.tan(degToRad(fov * 0.5));
  let height = 2 * top;
  let width = aspect * height;
  let left = - 0.5 * width;
  const cameraProjectionTransform = new Float32Array(
    new THREE.Matrix4().makePerspective(
      left, left + width, top, top - height, near, far,
    ).toArray(),
  )
  device.queue.writeBuffer(
    uniformBuffers.projectionTransform,
    0,
    cameraProjectionTransform.buffer,
    cameraProjectionTransform.byteOffset,
    cameraProjectionTransform.byteLength,
  );
}