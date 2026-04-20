# 🦜 SwitchX Clone

> **Clone completo e funcional do [Beeble SwitchX](https://app.beeble.ai/switchx)** – substituição de fundo de vídeos com IA, rodando 100% localmente, sem API externa.

![SwitchX Clone Banner](https://via.placeholder.com/1200x400/0d1117/0ea5e9?text=SwitchX+Clone+%E2%80%93+AI+Video+Background+Replacement)

---

## 🎯 O que faz

| Recurso | Descrição |
|---------|-----------|
| 🎞️ **Entrada** | Vídeo MP4/MOV (até 10s, até 200 MB) |
| 🖼️ **Fundo** | Qualquer imagem JPG/PNG/WebP |
| ✂️ **Segmentação** | BiRefNet (cabelo, óculos, bordas finas) |
| 💡 **Re-iluminação** | IC-Light / color transfer adaptativo |
| 🌑 **Sombras** | MiDaS depth + shadow projetada + contact shadow |
| 🎬 **Saída** | MP4 H.264, mesma duração e FPS |
| 🔒 **Privacidade** | 100% local – nenhum dado sai do computador |

---

## 🛠️ Stack de Tecnologias

### Backend
- **Node.js 20** + Express 4 + Socket.IO (progresso em tempo real)
- **FFmpeg** – extração de frames e montagem do vídeo final
- **Python 3.9+** – pipeline de IA chamado via `child_process`
- **Multer** – upload de vídeo/imagem

### IA (Python)
| Modelo | Finalidade | Tamanho |
|--------|-----------|---------|
| [BiRefNet](https://huggingface.co/ZhengPeng7/BiRefNet) | Segmentação principal | ~300 MB |
| [rembg/isnet](https://github.com/danielgatis/rembg) | Fallback de segmentação | ~170 MB |
| [MiDaS Small](https://github.com/isl-org/MiDaS) | Estimativa de profundidade | ~82 MB |
| IC-Light *(opcional)* | Re-iluminação física | ~1.7 GB |

### Frontend
- **React 18** + **Vite 5** + **TailwindCSS 3**
- Socket.IO client (barra de progresso em tempo real)
- react-dropzone, react-hot-toast, lucide-react

---

## 📋 Requisitos

| Requisito | Mínimo | Recomendado |
|-----------|--------|-------------|
| Node.js | 18.x | 20.x LTS |
| Python | 3.9 | 3.11 |
| FFmpeg | qualquer | última versão |
| RAM | 8 GB | 16 GB |
| GPU | não obrigatório | NVIDIA CUDA 11.8+ |
| Disco | 4 GB | 10 GB (com IC-Light) |

---

## 🚀 Instalação Rápida

### Opção 1 – Script automático (recomendado)

```bash
git clone https://github.com/bewingsaibr-lgtm/switchx-clone.git
cd switchx-clone
chmod +x setup.sh
./setup.sh
```

### Opção 2 – Manual

```bash
# 1. Clone
git clone https://github.com/bewingsaibr-lgtm/switchx-clone.git
cd switchx-clone

# 2. Backend
cd backend
npm install
cp .env.example .env

# 3. Python (CPU)
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# 4. Baixar modelos de IA
cd ..
python scripts/download_models.py

# 5. Frontend
cd frontend
npm install
```

### Opção 3 – Docker

```bash
# CPU
docker-compose up --build

# Com GPU (requer nvidia-container-toolkit)
docker-compose --profile gpu up --build
```

---

## ▶️ Executar

```bash
# Terminal 1 – Backend (porta 3001)
cd backend
npm run dev

# Terminal 2 – Frontend (porta 3000)
cd frontend
npm run dev
```

Acesse **http://localhost:3000** 🎉

---

## 📁 Estrutura do Projeto

```
switchx-clone/
├── backend/
│   ├── server.js              # Express + Socket.IO
│   ├── package.json
│   ├── requirements.txt       # Dependências Python
│   ├── .env.example
│   ├── Dockerfile
│   ├── routes/
│   │   └── switchx.js         # Rota POST /api/switchx/process
│   ├── services/
│   │   ├── pipeline.py        # Orquestrador principal (Python)
│   │   ├── segmentation.py    # BiRefNet + rembg + GrabCut fallback
│   │   ├── relighting.py      # IC-Light / color transfer
│   │   ├── composition.py     # MiDaS + sombras + compositing
│   │   └── videoProcessor.js  # FFmpeg helpers
│   └── models/                # Pesos dos modelos (baixados automaticamente)
│       ├── birefnet/
│       ├── modnet/
│       ├── iclight/
│       └── midas/
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Aplicação principal
│   │   ├── main.jsx
│   │   ├── index.css          # TailwindCSS + estilos customizados
│   │   └── components/
│   │       ├── UploadZone.jsx         # Upload de vídeo com drag-and-drop
│   │       ├── BackgroundUpload.jsx   # Upload da imagem de fundo
│   │       ├── MaskPreview.jsx        # Preview da máscara de segmentação
│   │       ├── ProcessingProgress.jsx # Barra de progresso em tempo real
│   │       └── ResultPlayer.jsx       # Player de vídeo + comparação
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── Dockerfile
├── scripts/
│   └── download_models.py     # Downloader de modelos
├── docker-compose.yml
├── setup.sh                   # Instalação automática
└── README.md
```

---

## 🔄 Pipeline de Processamento

```
Vídeo + Fundo
    │
    ▼
┌─────────────────┐
│  FFmpeg Extract │  Extrai frames individuais (PNG)
└────────┬────────┘
         │ frames/
         ▼
┌─────────────────────────────────────────────────────┐
│                Python AI Pipeline                    │
│                                                     │
│  ┌──────────────┐    ┌────────────┐    ┌──────────┐ │
│  │  BiRefNet    │───▶│  Relight   │───▶│ Compose  │ │
│  │  Segmentation│    │  IC-Light  │    │ + Shadow │ │
│  │  (alpha mask)│    │  /fallback │    │ MiDaS    │ │
│  └──────────────┘    └────────────┘    └──────────┘ │
└─────────────────────────────────────────────────────┘
         │ processed frames/
         ▼
┌─────────────────┐
│  FFmpeg Encode  │  H.264 MP4 + áudio original
└────────┬────────┘
         │
         ▼
      final.mp4 ✅
```

---

## ⚙️ Configuração (.env)

```env
PORT=3001
PYTHON_BIN=python3
TORCH_DEVICE=auto          # auto | cuda | cpu
HF_HOME=./models/huggingface
MAX_UPLOAD_MB=200
CLEANUP_FRAMES=true
```

---

## 🔧 IC-Light (Re-iluminação avançada)

Por padrão, o sistema usa color transfer + tint adaptativo para re-iluminação.
Para usar o IC-Light completo:

1. Baixe os pesos: https://huggingface.co/lllyasviel/ic-light
2. Salve em `backend/models/iclight/iclight_sd15_fc.safetensors`
3. Reinicie o backend

---

## 📊 Performance Esperada

| Hardware | Vídeo 5s @ 30fps | Vídeo 10s @ 30fps |
|----------|-----------------|-----------------|
| CPU (i7) | ~8 min | ~15 min |
| NVIDIA RTX 3060 | ~90s | ~3 min |
| NVIDIA RTX 4090 | ~30s | ~60s |

---

## 🐛 Solução de Problemas

### Backend não inicia
```bash
# Verificar se Node.js ≥18
node -v

# Reinstalar dependências
cd backend && rm -rf node_modules && npm install
```

### Erro no pipeline Python
```bash
# Testar segmentação isolada
cd backend
python3 services/segmentation.py imagem.jpg output_alpha.png

# Ver logs completos
npm run dev  # os logs Python aparecem no console
```

### FFmpeg não encontrado
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Verificar
ffmpeg -version
```

### Sem GPU / CUDA
```bash
# Instalar versão CPU do PyTorch
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
```

---

## 📜 Licença

MIT License – veja [LICENSE](LICENSE)

---

## 🙏 Créditos

- [Beeble SwitchX](https://app.beeble.ai/switchx) – inspiração e conceito
- [BiRefNet](https://github.com/ZhengPeng7/BiRefNet) – segmentação de alta precisão
- [IC-Light](https://github.com/lllyasviel/IC-Light) – re-iluminação baseada em IA
- [MiDaS](https://github.com/isl-org/MiDaS) – estimativa de profundidade monocular
- [rembg](https://github.com/danielgatis/rembg) – remoção de fundo (fallback)

---

<div align="center">
  <strong>Feito com ❤️ – SwitchX Clone | 100% Local | Sem nuvem</strong>
</div>
