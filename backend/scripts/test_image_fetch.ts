
import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function checkImage() {
  const url = 'http://localhost:4002/uploads/logos/logo-1769606538434-104757157.png';
  console.log('Fetching:', url);
  try {
    const resp = await axios.get(url);
    console.log('Status:', resp.status);
    console.log('Headers:', resp.headers);
    console.log('Content Length:', resp.headers['content-length']);
  } catch (error: any) {
    console.error('Error fetching image:', error.message);
    if (error.response) {
      console.log('Response status:', error.response.status);
      console.log('Response headers:', error.response.headers);
    }
  }
}

checkImage();
