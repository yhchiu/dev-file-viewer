export async function hello(name = 'Dev File Viewer') {
  const message = `Hello, ${name}!`;
  console.log(message);
  return message;
}
