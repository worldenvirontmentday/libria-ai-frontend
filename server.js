const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// Supabase setup
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// OpenAI API setup
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

app.post('/api/register', async (req, res) => {
  const { nama, email, telepon, alamat } = req.body;

  let responseText = '';
  let qrCodeData = '';

  if (!nama) {
    responseText = 'Mohon masukkan nama lengkap Anda.';
  } else if (!email) {
    responseText = 'Terima kasih, sekarang masukkan alamat email Anda.';
  } else if (!telepon) {
    responseText = 'Baik, sekarang masukkan nomor telepon Anda.';
  } else if (!alamat) {
    responseText = 'Terakhir, masukkan alamat Anda.';
  } else {
    // Generate UUID dan QR code
    const userId = uuidv4();
    qrCodeData = await QRCode.toDataURL(userId); // QR code berisi user ID
    responseText = 'Terima kasih, data Anda sudah lengkap.';

    // Simpan ke Supabase
    const { error } = await supabase
      .from('users')
      .insert([{ id: userId, nama, email, telepon, alamat, qr_code: qrCodeData }]);
    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ respond: 'Terjadi kesalahan saat menyimpan data.' });
    }
  }

  // Kirim ke OpenAI tanpa menyertakan qr_code di respons
  try {
    const openaiResponse = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are Libria, a library AI assistant. Respond based on user input: ${JSON.stringify({ nama, email, telepon, alamat })}. If data is complete, confirm registration. If not, request missing fields. Format response as JSON: { "nama": "", "email": "", "telepon": "", "alamat": "", "respond": "" }`
          },
          { role: 'user', content: JSON.stringify({ nama, email, telepon, alamat }) }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiResponse = openaiResponse.data.choices[0].message.content;
    res.json(JSON.parse(aiResponse));
  } catch (error) {
    console.error('OpenAI error:', error);
    res.json({ nama, email, telepon, alamat, respond: responseText });
  }
});

app.post('/api/login', async (req, res) => {
  const { barcode } = req.body;

  // Verifikasi barcode atau QR code di Supabase
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', barcode)
    .single();

  if (error || !data) {
    return res.json({ success: false });
  }

  res.json({ success: true });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
