
import { ParsingResult } from "../types";

export async function parseDocument(file: File): Promise<ParsingResult> {
  console.log('Frontend: Preparing to upload file:', file.name, file.type, file.size);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const hostname = window.location.hostname;
    const response = await fetch(`http://${hostname}:3001/api/parse-document`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${errorText}`);
    }

    const data = await response.json();
    return data as ParsingResult;
  } catch (error) {
    console.error("Error al procesar el documento:", error);
    throw error;
  }
}
