const shaders = `
struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f
}
@binding(0) @group(0) var<uniform> offset : vec4f;

@vertex
fn vertex_main(@location(0) position: vec4f,
               @location(1) color: vec4f) -> VertexOut
{
  var output : VertexOut;
  output.position = position + offset;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
  return fragData.color;
}
`;

interface App {
  state: {
    offset: [x: number, y: number],
  };
  device: GPUDevice;
  canvasCtx: GPUCanvasContext;
  pipelines: {
    main: GPURenderPipeline,
  };
  vertexBuffers: {
    main: GPUBuffer,
  };
  uniformBuffers: {
    offset: GPUBuffer,
  };
  uniformBindGroups: {
    main: GPUBindGroup,
  };
  renderPassDescriptor: GPURenderPassDescriptor;
}

const verticesDataAttrs: GPUVertexBufferLayout['attributes'] = [
  {
    shaderLocation: 0, // position
    offset: 0,
    format: "float32x4",
  },
  {
    shaderLocation: 1, // color
    offset: 16,
    format: "float32x4",
  },
]
const verticesDataStride = 32; // 4 * 4 + 4 * 4 byte
const verticesData = new Float32Array([
  0.0, 0.6, 0, 1,
  1, 0, 0, 1,

  -0.5, -0.6, 0, 1,
  0, 1, 0, 1,

  0.5, -0.6, 0, 1,
  0, 0, 1, 1,
]);

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

  const pipelines = {} as App['pipelines'];
  pipelines.main = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: [
        { // slot 0
          attributes: verticesDataAttrs,
          arrayStride: verticesDataStride,
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
    },
    layout: "auto",
  });

  const vertexBuffers = {} as App['vertexBuffers'];
  vertexBuffers.main = device.createBuffer({
    size: verticesData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(vertexBuffers.main.getMappedRange()).set(verticesData);
  vertexBuffers.main.unmap();

  const uniformBuffers = {} as App['uniformBuffers'];
  uniformBuffers.offset = device.createBuffer({
    size: 4 * 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const uniformBindGroups = {} as App['uniformBindGroups'];
  uniformBindGroups.main = device.createBindGroup({
    layout: pipelines.main.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffers.offset,
        },
      },
    ],
  });

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
        view: canvasCtx.getCurrentTexture().createView(),
      },
    ],
  }

  const app: App = {
    state: {
      offset: [0, 0],
    },

    device, canvasCtx,
    pipelines,
    vertexBuffers, uniformBuffers,
    uniformBindGroups,
    renderPassDescriptor,
  }

  render(app);

  document.body.addEventListener('keydown', (e) => {
    switch(e.key) {
      case 'ArrowLeft':
        app.state.offset[0] -= 0.1;
        render(app);
        break;
      case 'ArrowRight':
        app.state.offset[0] += 0.1;
        render(app);
        break;
      case 'ArrowDown':
        app.state.offset[1] -= 0.1;
        render(app);
        break;
      case 'ArrowUp':
        app.state.offset[1] += 0.1;
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

  const offset = new Float32Array([state.offset[0], state.offset[1], 0, 0]);
  device.queue.writeBuffer(
    uniformBuffers.offset,
    0,
    offset.buffer,
    offset.byteOffset,
    offset.byteLength,
  );

  const commandEncoder = device.createCommandEncoder();

  (renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view = canvasCtx
    .getCurrentTexture()
    .createView();

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);

  passEncoder.setPipeline(pipelines.main);
  passEncoder.setBindGroup(0, uniformBindGroups.main);
  passEncoder.setVertexBuffer(0, vertexBuffers.main);
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}