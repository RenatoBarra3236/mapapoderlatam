# Setup Backend - Python FastAPI + MySQL

## Prerequisitos
- Python 3.8+
- MySQL 5.7+ o MariaDB
- pip

## Pasos de instalación

### 1. Crear virtual environment
```bash
cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
```

### 2. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
```

Editar `.env` con tus valores:
```
PORT=3001
DATABASE_URL=mysql+pymysql://usuario:password@localhost:3306/mapapoderlatam
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-tu-api-key-aqui
```

### 4. Crear base de datos en MySQL
```bash
mysql -u root -p
```

Luego ejecutar el SQL:
```sql
CREATE DATABASE IF NOT EXISTS mapapoderlatam CHARACTER SET utf8mb4;
```

O usar el script automático:
```bash
python init_db.py
```

### 5. Inicializar base de datos
```bash
python init_db.py
```

Esto va a:
- ✅ Crear las tablas (nodes, edges)
- ✅ Cargar datos de ejemplo (4 personas, 3 empresas, 3 contratos, 10 relaciones)

### 6. Iniciar servidor
```bash
python -m uvicorn app:app --reload --port 3001
```

El servidor estará en: `http://localhost:3001`

## Endpoints disponibles

### Health Check
```
GET /api/health
```

### Graph
```
GET /api/graph/{nodeId}?depth=2
GET /api/graph/{nodeId}/stats
```

### Search
```
GET /api/search?q=carlos&limit=10
```

## Estructura del proyecto
```
backend/
├── app.py                      # FastAPI app principal
├── requirements.txt            # Dependencias Python
├── .env.example               # Plantilla variables
├── config/
│   ├── database.py            # Conexión MySQL
│   ├── settings.py            # Configuración
│   └── schema.sql             # Schema MySQL
├── models/
│   ├── node.py                # Modelo Node
│   └── edge.py                # Modelo Edge
├── schemas/
│   ├── node.py                # Pydantic schemas
│   └── edge.py
├── routes/
│   ├── graph.py               # GET /api/graph/*
│   └── search.py              # GET /api/search
├── controllers/
│   ├── graph_controller.py    # Lógica grafo
│   └── search_controller.py   # Lógica búsqueda
└── utils/
    ├── claude_client.py       # Claude API
    └── seed.py                # Datos iniciales
```

## Desarrollo

### Logs en consola
El servidor en desarrollo muestra logs de SQL y requests

### Cambios en código
Con `--reload`, el servidor reinicia automáticamente al modificar archivos

### Documentación interactiva
Accede a `http://localhost:3001/docs` para la documentación Swagger

## Troubleshooting

### Error de conexión a MySQL
- Verifica que MySQL esté corriendo: `mysql -u root -p`
- Verifica DATABASE_URL en `.env`

### Error de imports
- Asegúrate de estar en la carpeta `backend`
- Virtual env activado

### Datos no se cargan
```bash
python init_db.py
```

## Frontend
El frontend no requiere cambios. Usa:
```
VITE_API_URL=http://localhost:3001/api
```
