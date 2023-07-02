const shaders = `
struct VertexOut {
  @builtin(position) position : vec4f,
  @location(0) color : vec4f
}

@vertex
fn vertex_main(@location(0) position: vec4f,
               @location(1) color: vec4f) -> VertexOut
{
  var output : VertexOut;
  output.position = position;
  output.color = color;
  return output;
}

@fragment
fn fragment_main(fragData: VertexOut) -> @location(0) vec4f
{
  return fragData.color;
}
`;

const verticesData = new Float32Array([
  0.0, 0.6, 0, 1,
  1, 0, 0, 1,

  -0.5, -0.6, 0, 1,
  0, 1, 0, 1,

  0.5, -0.6, 0, 1,
  0, 0, 1, 1,
]);

export default async function main(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('webgpu');
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return

  const preferredCanvasFormat = navigator.gpu.getPreferredCanvasFormat()
  const device = await adapter.requestDevice();

  context.configure({
    device: device,
    format: preferredCanvasFormat,
    alphaMode: "premultiplied",
  });

  const shaderModule = device.createShaderModule({
    code: shaders,
  });

  const verticesBuffer = device.createBuffer({
    size: verticesData.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(verticesBuffer.getMappedRange()).set(verticesData);
  verticesBuffer.unmap();

  const renderPipeline  = device.createRenderPipeline({
    vertex: {
      module: shaderModule,
      entryPoint: "vertex_main",
      buffers: [
        {
          attributes: [
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
          ],
          arrayStride: 32,
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

  const commandEncoder = device.createCommandEncoder();

  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        clearValue: { r: 1.0, g: 1.0, b: 1.0, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
        view: context.getCurrentTexture().createView(),
      },
    ],
  });

  passEncoder.setPipeline(renderPipeline);
  passEncoder.setVertexBuffer(0, verticesBuffer);
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
}