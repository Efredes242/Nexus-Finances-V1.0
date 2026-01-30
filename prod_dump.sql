PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  password TEXT,
  role TEXT DEFAULT 'user',
  must_change_password INTEGER DEFAULT 0,
  email TEXT,
  google_id TEXT,
  avatar TEXT,
  firstName TEXT,
  lastName TEXT,
  birthDate TEXT
);
INSERT INTO "users" VALUES('f59e997d-4160-489d-a9ab-83c81861c96e','efredes98','$2b$10$kMTvlUA2L6k8LgXOameTR.t/S.HGF6pCFj4D6kkDFPlq3fbaudIiu','user',0,NULL,NULL,NULL,'Ezequiel','Fredes','1998-03-25');
INSERT INTO "users" VALUES('6ec631c6-2cb3-401e-84a4-1b49c55c38e5','ezequiel.fredes.mondragon','$2b$10$K7a86EW/tZk34zS6u3FIs.soOLMDtYtj8bCPvrGZ.EIZ1rR5Y5Bmy','user',0,'ezequiel.fredes.mondragon@gmail.com','109529060601290479923','https://lh3.googleusercontent.com/a/ACg8ocKQugaGSidvRzchLAMOgLfXFmQfaQy84oc7sTGG_Qm-kJiSrMo=s96-c','Ezequiel','Fredes','1998-03-25');
INSERT INTO "users" VALUES('c321ae26-0aa9-4ba0-8389-7f84758ac8ec','leandrofredes25','$2b$10$FXyQtIkTK6YNAPnLNPw8j.9AaXO5s12WlAnLjdE8d.JLECGR.qDlC','user',0,'leandrofredes25@gmail.com','117799365748813036682','https://lh3.googleusercontent.com/a/ACg8ocKZMunJjYCKAnixtDAO6kIZ5sEUbr67sjWc43HhCt_6vF1YR6jQbw=s96-c','Leandro Tahiel','Fredes','1992-02-24');
CREATE TABLE entries (
  id TEXT PRIMARY KEY,
  name TEXT,
  amount REAL,
  category TEXT,
  tag TEXT,
  date TEXT,
  status TEXT,
  paymentMethod TEXT,
  month_year TEXT,
  cardName TEXT,
  financingPlan TEXT,
  originalAmount REAL,
  currency TEXT,
  exchangeRateEstimated REAL,
  exchangeRateActual REAL,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  name TEXT,
  targetAmount REAL,
  currentAmount REAL,
  deadline TEXT,
  icon TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE installments (
  id TEXT PRIMARY KEY,
  name TEXT,
  totalAmount REAL,
  installments INTEGER,
  startDate TEXT,
  description TEXT,
  category TEXT,
  cardName TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE TABLE user_configs (
  user_id TEXT PRIMARY KEY,
  currency TEXT,
  categories TEXT,
  creditCards TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
INSERT INTO "user_configs" VALUES('f59e997d-4160-489d-a9ab-83c81861c96e','$','{"Ingresos":["Sueldo","Aguinaldo","Extras","Ventas","Inversiones","Regalos"],"Gastos Fijos":["Alquiler / Cuota Préstamo","Expensas","Servicios (Luz, Gas, Agua)","Internet","Teléfono / Celular","TV / Streaming","Colegio","Cuota del Auto","Seguros","Prepaga / Obra Social","Impuestos","Gimnasio","Cochera","Patente"],"Gastos Variables":["Supermercado","Comida / Delivery","Salidas / Ocio","Transporte / Combustible","Farmacia / Salud","Ropa","Mantenimiento Hogar","Mascotas","Regalos","Cuidado Personal","Deportes","Educación / Cursos","Vacaciones","Varios"],"Deudas":["Préstamo Personal","Tarjeta de Crédito","Deuda Familiar"],"Ahorros":["Fondo de Emergencia","Ahorro Dólares","Inversiones","Vacaciones","Auto Nuevo"]}','[]');
INSERT INTO "user_configs" VALUES('6ec631c6-2cb3-401e-84a4-1b49c55c38e5','$','{"Ingresos":["Sueldo","Aguinaldo","Extras","Ventas","Inversiones","Regalos"],"Gastos Fijos":["Alquiler / Cuota Préstamo","Expensas","Servicios (Luz, Gas, Agua)","Internet","Teléfono / Celular","TV / Streaming","Colegio","Cuota del Auto","Seguros","Prepaga / Obra Social","Impuestos","Gimnasio","Cochera","Patente","Cuota Alimentaria","Electrodoméstico"],"Gastos Variables":["Supermercado","Comida / Delivery","Salidas / Ocio","Transporte / Combustible","Farmacia / Salud","Ropa","Mantenimiento Hogar","Mascotas","Regalos","Cuidado Personal","Deportes","Educación / Cursos","Vacaciones","Varios"],"Deudas":["Préstamo Personal","Tarjeta de Crédito","Deuda Familiar"],"Ahorros":["Fondo de Emergencia","Ahorro Dólares","Inversiones","Vacaciones","Auto Nuevo"]}','["VISA SANTANDER RIO","VISA BruBank"]');
INSERT INTO "user_configs" VALUES('c321ae26-0aa9-4ba0-8389-7f84758ac8ec','$','{"Ingresos":["Sueldo","Aguinaldo","Extras","Ventas","Inversiones","Regalos"],"Gastos Fijos":["Alquiler / Cuota Préstamo","Expensas","Servicios (Luz, Gas, Agua)","Internet","Teléfono / Celular","TV / Streaming","Colegio","Cuota del Auto","Seguros","Prepaga / Obra Social","Impuestos","Gimnasio","Cochera","Patente"],"Gastos Variables":["Supermercado","Comida / Delivery","Salidas / Ocio","Transporte / Combustible","Farmacia / Salud","Ropa","Mantenimiento Hogar","Mascotas","Regalos","Cuidado Personal","Deportes","Educación / Cursos","Vacaciones","Varios"],"Deudas":["Préstamo Personal","Tarjeta de Crédito","Deuda Familiar"],"Ahorros":["Fondo de Emergencia","Ahorro Dólares","Inversiones","Vacaciones","Auto Nuevo"]}','[]');
CREATE TABLE category_budgets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category TEXT,
  amount REAL,
  UNIQUE(user_id, category),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
