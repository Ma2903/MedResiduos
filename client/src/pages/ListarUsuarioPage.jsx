import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaUserPlus } from 'react-icons/fa';

import { getUsuarios, deleteUsuario } from '../services/api';
import './styles/ListPage.css';

const ListarUsuarioPage = () => {
    const [usuarios, setUsuarios] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'nome', direction: 'ascending' });

    // Pega o ID do usuário logado do localStorage para a verificação de segurança
    const loggedInUserId = parseInt(localStorage.getItem('userId'), 10);

    useEffect(() => {
        getUsuarios()
            .then(data => setUsuarios(data))
            .catch(err => {
                console.error("Falha ao buscar usuários:", err);
                setError("Não foi possível carregar os usuários. Tente novamente mais tarde.");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = (userId) => {
        Swal.fire({
            title: 'Você tem certeza?',
            text: "Esta ação não poderá ser revertida!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sim, apagar!',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                deleteUsuario(userId)
                    .then(() => {
                        setUsuarios(currentUsers => currentUsers.filter(user => user.id_usuario !== userId));
                        Swal.fire('Apagado!', 'O usuário foi removido.', 'success');
                    })
                    .catch(err => Swal.fire('Erro!', 'Não foi possível remover o usuário.', 'error'));
            }
        });
    };
    
    const processedUsuarios = useMemo(() => {
        let sortableItems = [...usuarios];

        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }

        if (!searchTerm) return sortableItems;
        
        return sortableItems.filter(usuario =>
            (usuario.nome && usuario.nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (usuario.email && usuario.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [usuarios, sortConfig, searchTerm]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (name) => {
        if (sortConfig.key !== name) return null;
        return sortConfig.direction === 'ascending' ? <FaArrowUp className="sort-icon" /> : <FaArrowDown className="sort-icon" />;
    };

    if (loading) return <div className="page-container"><h2>A carregar...</h2></div>;
    if (error) return <div className="page-container"><p className="error-message">{error}</p></div>;

    return (
        <div className="page-container">
            <div className="list-page-header">
                <div className="page-title">
                    <FaUserPlus className="icon" />
                    <h1>Gerenciamento de Usuários</h1>
                </div>
                <Link to="/cadastro-profissional" className="add-button">
                    <FaPlus /> Cadastrar Usuário
                </Link>
            </div>

            <div className="filter-container">
                <div className="search-wrapper">
                    <FaSearch className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th><button type="button" onClick={() => requestSort('nome')} className="sortable-header">Nome {getSortIcon('nome')}</button></th>
                            <th><button type="button" onClick={() => requestSort('email')} className="sortable-header">Email {getSortIcon('email')}</button></th>
                            <th><button type="button" onClick={() => requestSort('cidade')} className="sortable-header">Cidade {getSortIcon('cidade')}</button></th>
                            <th><button type="button" onClick={() => requestSort('tipo')} className="sortable-header">Tipo {getSortIcon('tipo')}</button></th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedUsuarios.map(usuario => {
                            const isCurrentUser = loggedInUserId === usuario.id_usuario;
                            
                            return (
                                <tr key={usuario.id_usuario}>
                                    <td>{usuario.nome}</td>
                                    <td>{usuario.email}</td>
                                    <td>{usuario.cidade || 'N/A'}</td>
                                    <td>{usuario.tipo}</td>
                                    <td className="actions-cell">
                                        <Link 
                                            to={`/editar-usuario/${usuario.id_usuario}`} 
                                            className={`btn-action btn-edit ${isCurrentUser ? 'disabled' : ''}`}
                                            onClick={(e) => { if (isCurrentUser) e.preventDefault(); }}
                                            aria-disabled={isCurrentUser}
                                            tabIndex={isCurrentUser ? -1 : undefined}
                                        >
                                            <FaEdit /> Editar
                                        </Link>
                                        <button 
                                            onClick={() => handleDelete(usuario.id_usuario)} 
                                             className={`btn-action btn-delete ${isCurrentUser ? 'disabled' : ''}`}
                                            disabled={isCurrentUser}
                                        >
                                            <FaTrash /> Excluir
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ListarUsuarioPage;