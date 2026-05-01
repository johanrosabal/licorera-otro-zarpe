import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { secret } = await request.json();
    
    // Read secret from root file
    const filePath = path.join(process.cwd(), 'admin_secret.json');
    const fileContent = await fs.readFile(filePath, 'utf8');
    const { adminRegistrationSecret } = JSON.parse(fileContent);

    if (secret === adminRegistrationSecret) {
      return NextResponse.json({ valid: true });
    } else {
      return NextResponse.json({ valid: false }, { status: 401 });
    }
  } catch (error) {
    console.error('Error verifying admin secret:', error);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
