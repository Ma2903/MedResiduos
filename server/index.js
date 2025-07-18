// server/index.js
const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer'); // Dependência para enviar emails

const app = express();
const PORT = 3001;
const SALT_ROUNDS = 10;
const JWT_SECRET = 'MedResiduosSecretKey'; 

// Middlewares
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO DO SERVIÇO DE EMAIL (NODEMAILER) ---
// ATENÇÃO: Substitua com as suas credenciais. Use variáveis de ambiente em produção!
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: "manoelaps2022@gmail.com", // Insira o seu email do Gmail
        pass: "aryl sfjn tojr bzdv"  // Insira a sua "Senha de App" gerada no Google
    },
});

// Armazenamento temporário dos códigos de redefinição.
// Em produção, isto deve ser feito numa tabela no banco de dados com data de expiração.
const resetCodes = {};

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'API do MedResiduos a funcionar!' });
});

// --- ROTAS DE GESTÃO DE USUÁRIOS (CRUD) ---

app.get('/usuarios', (req, res) => {
  db.query('SELECT id_usuario, nome, email, tipo, cidade, uf FROM usuario', (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários' });
    res.json(results);
  });
});

app.get('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT id_usuario, nome, email, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf FROM usuario WHERE id_usuario = ?';
  db.query(query, [id], (err, results) => {
    if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(results[0]);
  });
});

app.post('/usuarios', async (req, res) => {
    const { nome, email, senha, tipoUsuario, cep, logradouro, numero, complemento, bairro, cidade, uf } = req.body;
    if (!nome || !email || !senha || !tipoUsuario) return res.status(400).json({ error: 'Nome, email, senha e tipo são obrigatórios.' });
    try {
        const hashedPassword = await bcrypt.hash(senha, SALT_ROUNDS);
        const query = 'INSERT INTO usuario (nome, email, senha, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const values = [nome, email, hashedPassword, tipoUsuario, cep, logradouro, numero, complemento, bairro, cidade, uf];
        db.query(query, values, (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Este email já está em uso.' });
                return res.status(500).json({ error: 'Erro ao cadastrar usuário' });
            }
            res.status(201).json({ message: 'Usuário cadastrado com sucesso!', userId: result.insertId });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
});

app.put('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nome, email, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf } = req.body;
  if (!nome || !email || !tipo) return res.status(400).json({ error: 'Nome, email e tipo são obrigatórios' });
  const query = 'UPDATE usuario SET nome = ?, email = ?, tipo = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ? WHERE id_usuario = ?';
  const values = [nome, email, tipo, cep, logradouro, numero, complemento, bairro, cidade, uf, id];
  db.query(query, values, (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao atualizar usuário' });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Usuário atualizado com sucesso!' });
  });
});

app.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usuario WHERE id_usuario = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao apagar usuário' });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json({ message: 'Usuário apagado com sucesso' });
  });
});

// --- ROTA DE LOGIN ---

app.post('/login', (req, res) => {
    const { email, password, lembrarMe } = req.body; 
    if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    db.query('SELECT * FROM usuario WHERE email = ?', [email], async (err, results) => {
        if (err) return res.status(500).json({ error: 'Erro interno do servidor' });
        if (results.length === 0) return res.status(401).json({ error: 'Email ou senha inválidos.' });
        const user = results[0];
        try {
            const match = await bcrypt.compare(password, user.senha);
            if (!match) return res.status(401).json({ error: 'Email ou senha inválidos.' });
            const { senha, ...userWithoutPassword } = user;
            const expiresIn = lembrarMe ? '30d' : '8h';
            const token = jwt.sign({ id: user.id_usuario, tipo: user.tipo }, JWT_SECRET, { expiresIn });
            res.json({ user: userWithoutPassword, token });
        } catch (error) {
            res.status(500).json({ error: 'Erro ao processar o login.' });
        }
    });
});

// --- MIDDLEWARE E ROTAS DE PERFIL ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

app.get('/perfil', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = 'SELECT nome, email, cep, logradouro, numero, complemento, bairro, cidade, uf FROM usuario WHERE id_usuario = ?';
    db.query(query, [userId], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        res.json(results[0]);
    });
});

app.put('/perfil', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { nome, email, cep, logradouro, numero, complemento, bairro, cidade, uf } = req.body;
    const query = 'UPDATE usuario SET nome = ?, email = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ? WHERE id_usuario = ?';
    const values = [nome, email, cep, logradouro, numero, complemento, bairro, cidade, uf, userId];
    db.query(query, values, (err, result) => {
        if (err) return res.status(500).json({ error: 'Erro ao atualizar o perfil.' });
        res.json({ message: 'Perfil atualizado com sucesso!' });
    });
});

app.put('/perfil/senha', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { senhaAtual, novaSenha } = req.body;
    db.query('SELECT senha FROM usuario WHERE id_usuario = ?', [userId], async (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        const hashedDbPassword = results[0].senha;
        const isMatch = await bcrypt.compare(senhaAtual, hashedDbPassword);
        if (!isMatch) return res.status(400).json({ error: 'A senha atual está incorreta.' });
        const newHashedPassword = await bcrypt.hash(novaSenha, SALT_ROUNDS);
        db.query('UPDATE usuario SET senha = ? WHERE id_usuario = ?', [newHashedPassword, userId], (err, result) => {
            if (err) return res.status(500).json({ error: 'Erro ao alterar a senha.' });
            res.json({ message: 'Senha alterada com sucesso!' });
        });
    });
});

// --- ROTAS PARA REDEFINIÇÃO DE SENHA ---

app.post('/forgot-password', (req, res) => {
    const { email } = req.body;
    db.query('SELECT * FROM usuario WHERE email = ?', [email], (err, results) => {
        if (err || results.length === 0) {
            return res.json({ message: 'Se um utilizador com este email existir, um código foi enviado.' });
        }
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const emailBody = `<p>O seu código de redefinição de senha é: <b>${code}</b>. Este código expira em 10 minutos.</p>`;
        const mailOptions = {
            from: '"MedResiduos" <manoelaps2022@gmail.com>', to: email,
            subject: "Código para Redefinição de Senha", html: emailBody,
        };
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) return res.status(500).json({ error: 'Erro ao enviar o email.' });
            resetCodes[email] = { code, timestamp: Date.now() };
            res.json({ message: 'Se um utilizador com este email existir, um código foi enviado.' });
        });
    });
});

app.post('/validate-code', (req, res) => {
    const { email, code } = req.body;
    const storedInfo = resetCodes[email];
    if (!storedInfo || storedInfo.code !== code) return res.status(400).json({ error: 'Código inválido ou expirado.' });
    if (Date.now() - storedInfo.timestamp > 600000) { // 10 minutos
        delete resetCodes[email];
        return res.status(400).json({ error: 'Código expirado. Por favor, solicite um novo.' });
    }
    res.json({ message: 'Código validado com sucesso.' });
});

app.post('/reset-password', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const storedInfo = resetCodes[email];
    if (!storedInfo || storedInfo.code !== code || (Date.now() - storedInfo.timestamp > 600000)) {
        return res.status(400).json({ error: 'A validação do código falhou. Por favor, tente o processo novamente.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
        db.query('UPDATE usuario SET senha = ? WHERE email = ?', [hashedPassword, email], (err, result) => {
            if (err) return res.status(500).json({ error: 'Erro ao redefinir a senha.' });
            delete resetCodes[email];
            res.json({ message: 'Senha redefinida com sucesso!' });
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao processar a nova senha.' });
    }
});


app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});