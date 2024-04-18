import { GetParameterCommand, PutParameterCommand } from "@aws-sdk/client-ssm"; // ES Modules import

export async function getSSMParamString(cli, Name) {
  if (!cli) return;
  try {
    const cmd = new GetParameterCommand({ Name });
    const res = await cli.send(cmd);
    return res?.Parameter?.Value;
  } catch (err) {
    return;
  }
}

export async function putSSMParamString(cli, Name, Value) {
  if (!cli) return;
  const cmd = new PutParameterCommand({ Name, Value, Overwrite: true });
  await cli.send(cmd);
}
