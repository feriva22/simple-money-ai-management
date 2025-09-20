'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import fireflyAPI from '../lib/firefly';
import { Container, Row, Col, Form, Button, ListGroup, Spinner, Alert, Badge, Card, ButtonGroup } from 'react-bootstrap';
import { Typeahead } from 'react-bootstrap-typeahead';
import 'react-bootstrap-typeahead/css/Typeahead.css';

// #region Helpers
const getLocalDateTime = (dateString) => {
  const date = dateString ? new Date(dateString) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const currencyFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const typeBadges = {
    withdrawal: { bg: 'danger', text: 'Withdrawal' },
    deposit: { bg: 'success', text: 'Deposit' },
    transfer: { bg: 'info', text: 'Transfer' },
};

const handleTypeaheadChange = (setter) => (selected) => {
    if (selected.length > 0) {
        const item = selected[0];
        setter(item.customOption ? item.label : (item.label || item));
    } else {
        setter('');
    }
};
// #endregion

// #region Sub-components
const AccountActivityCard = ({ title, account }) => {
    if (!account) return null;
    return (
        <Card>
            <Card.Body>
                <Card.Title>{title}: {account.name}</Card.Title>
                <Card.Subtitle className="mb-2 text-muted">Current Balance: {currencyFormatter.format(account.balance)}</Card.Subtitle>
                <hr />
                <p className="mb-2 fw-bold">Latest Activity:</p>
                <ListGroup variant="flush">
                    {account.transactions.map(t => {
                        const tx = t.attributes.transactions[0];
                        return (
                            <ListGroup.Item key={t.id} className="d-flex justify-content-between">
                                <span>{tx.description}</span>
                                <span className={tx.type === 'deposit' ? 'text-success' : 'text-danger'}> 
                                    {tx.type === 'deposit' ? '+' : '-'}{currencyFormatter.format(tx.amount)}
                                </span>
                            </ListGroup.Item>
                        )
                    })}
                </ListGroup>
            </Card.Body>
        </Card>
    )
}
// #endregion

export default function TransactionPage() {
  // #region State and Refs
  const descriptionRef = useRef(null);
  const sourceAccountRef = useRef(null);
  const destinationAccountRef = useRef(null);
  const categoryRef = useRef(null);
  const budgetRef = useRef(null);
  const mainFormRef = useRef(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('withdrawal');
  const [sourceAccount, setSourceAccount] = useState('');
  const [destinationAccount, setDestinationAccount] = useState('');
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [date, setDate] = useState(getLocalDateTime());

  const [assetAccounts, setAssetAccounts] = useState([]);
  const [expenseAccounts, setExpenseAccounts] = useState([]);
  const [revenueAccounts, setRevenueAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transactionDescriptions, setTransactionDescriptions] = useState([]);
  
  const [sourceAccountList, setSourceAccountList] = useState([]);
  const [destinationAccountList, setDestinationAccountList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [accountActivity, setAccountActivity] = useState(null);

  const [editingTransaction, setEditingTransaction] = useState(null);
  // #endregion

  const groupedTransactions = useMemo(() => {
    const groups = {};
    transactions.forEach(trans => {
        const dateKey = trans.attributes.transactions[0].date.split('T')[0];
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(trans);
    });
    return groups;
  }, [transactions]);

  const refreshData = async () => {
    setSubmitting(true);
    try {
        const [assetsRes, expensesRes, revenuesRes, categoriesRes, budgetsRes, transactionsRes] = await Promise.all([
            fireflyAPI.get('/accounts?type=asset'),
            fireflyAPI.get('/accounts?type=expense'),
            fireflyAPI.get('/accounts?type=revenue'),
            fireflyAPI.get('/categories'),
            fireflyAPI.get('/budgets'),
            fireflyAPI.get('/transactions?limit=50'),
        ]);
        const assets = assetsRes.data.data.map(a => a.attributes.name);
        const expenses = expensesRes.data.data.map(a => a.attributes.name);
        const revenues = revenuesRes.data.data.map(a => a.attributes.name);
        setAssetAccounts(assets); setExpenseAccounts(expenses); setRevenueAccounts(revenues);
        setCategories(categoriesRes.data.data.map(c => c.attributes.name));
        setBudgets(budgetsRes.data.data.map(b => b.attributes.name));
        const newTransactions = transactionsRes.data.data;
        setTransactions(newTransactions);
        setTransactionDescriptions([...new Set(newTransactions.map(t => t.attributes.transactions[0].description))]);
    } catch (err) { console.error(err); setError('Failed to refresh data.'); } finally { setSubmitting(false); }
  }

  // #region Effects
  useEffect(() => { setLoading(true); refreshData().finally(() => setLoading(false)); }, []);

  useEffect(() => {
    const isEditMode = !!editingTransaction;
    if (!isEditMode) {
        switch (type) {
            case 'withdrawal': setSourceAccountList(assetAccounts); setDestinationAccountList(expenseAccounts); break;
            case 'deposit': setSourceAccountList(revenueAccounts); setDestinationAccountList(assetAccounts); break;
            case 'transfer': setSourceAccountList(assetAccounts); setDestinationAccountList(assetAccounts); break;
            default: setSourceAccountList([]); setDestinationAccountList([]);
        }
        if (sourceAccount) setSourceAccount('');
        if (destinationAccount) setDestinationAccount('');
    }
  }, [type, editingTransaction, assetAccounts, expenseAccounts, revenueAccounts]);
  // #endregion

  const clearForm = () => {
    [descriptionRef, sourceAccountRef, destinationAccountRef, categoryRef, budgetRef].forEach(ref => ref.current?.clear());
    setDescription(''); setAmount(''); setSourceAccount(''); setDestinationAccount(''); setCategory(''); setBudget('');
    setDate(getLocalDateTime());
    setEditingTransaction(null);
    setAccountActivity(null);
  }

  // #region Handlers
  const handleEditClick = (transaction) => {
    setEditingTransaction(transaction);
    const tx = transaction.attributes.transactions[0];
    setDescription(tx.description);
    setAmount(Number.parseFloat(tx.amount).toFixed(0));
    setType(tx.type);
    setSourceAccount(tx.source_name);
    setDestinationAccount(tx.destination_name);
    setCategory(tx.category_name || '');
    setBudget(tx.budget_name || '');
    setDate(getLocalDateTime(tx.date));
    mainFormRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  const handleDelete = async (transactionId) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
        setSubmitting(true);
        try {
            await fireflyAPI.delete(`/transactions/${transactionId}`);
            await refreshData();
        } catch (err) { console.error("Failed to delete transaction", err); setError("Failed to delete transaction."); } finally { setSubmitting(false); }
    }
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);
    setAccountActivity(null);
    setSubmitting(true);

    if (!description || !amount || !sourceAccount || !destinationAccount) {
      setError('Please fill out all required fields.');
      setSubmitting(false);
      return;
    }

    const transactionPayload = { type, date, amount, description, source_name: sourceAccount, destination_name: destinationAccount };
    if (budget) transactionPayload.budget_name = budget;
    if (category) transactionPayload.category_name = category;

    try {
        let postRes;
        if (editingTransaction) {
            const originalTx = editingTransaction.attributes.transactions[0];
            const payload = { transactions: [{...originalTx, ...transactionPayload}] };
            postRes = await fireflyAPI.put(`/transactions/${editingTransaction.id}`, payload);
        } else {
            postRes = await fireflyAPI.post('/transactions', { transactions: [transactionPayload] });
        }

        setSubmitStatus('success');
        const tx = postRes.data.data.attributes.transactions[0];
        const [sourceAcc, destAcc, sourceTrans, destTrans] = await Promise.all([
            fireflyAPI.get(`/accounts/${tx.source_id}`), fireflyAPI.get(`/accounts/${tx.destination_id}`),
            fireflyAPI.get(`/accounts/${tx.source_id}/transactions?limit=2`), fireflyAPI.get(`/accounts/${tx.destination_id}/transactions?limit=2`)
        ]);
        setAccountActivity({ source: { name: sourceAcc.data.data.attributes.name, balance: sourceAcc.data.data.attributes.current_balance, transactions: sourceTrans.data.data }, destination: { name: destAcc.data.data.attributes.name, balance: destAcc.data.data.attributes.current_balance, transactions: destTrans.data.data } });

        clearForm();
        await refreshData();
    } catch (err) { console.error(err); setSubmitStatus('error'); } finally { setSubmitting(false); }
  };
  // #endregion

  return (
    <Container className="py-5">
      <Row>
        <Col md={{ span: 8, offset: 2 }}>
          <div className="d-flex justify-content-between align-items-center mb-4"><h1 className="mb-0">Money Management</h1><Button variant="secondary" href="/api/auth/logout">Logout</Button></div>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="p-4 border rounded-lg shadow-sm mb-5" ref={mainFormRef}>
            <h2 className="mb-3">{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</h2>
            <Form onSubmit={handleFormSubmit}>
                <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label>Description</Form.Label><Typeahead id="description" ref={descriptionRef} allowNew options={transactionDescriptions} placeholder="e.g., Groceries, Salary" selected={description ? [description] : []} onChange={handleTypeaheadChange(setDescription)} onInputChange={setDescription} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Amount</Form.Label><Form.Control type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 50.25" required /></Form.Group></Col>
                </Row>
                <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label>Type</Form.Label><Form.Select value={type} onChange={(e) => setType(e.target.value)} disabled={!!editingTransaction}><option value="withdrawal">Withdrawal</option><option value="deposit">Deposit</option><option value="transfer">Transfer</option></Form.Select></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Date & Time</Form.Label><Form.Control type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required /></Form.Group></Col>
                </Row>
                <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label>Source Account</Form.Label><Typeahead id="source-account" ref={sourceAccountRef} allowNew options={sourceAccountList} placeholder="Choose or type..." selected={sourceAccount ? [sourceAccount] : []} onChange={handleTypeaheadChange(setSourceAccount)} onInputChange={setSourceAccount} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Destination Account</Form.Label><Typeahead id="destination-account" ref={destinationAccountRef} allowNew options={destinationAccountList} placeholder="Choose or type..." selected={destinationAccount ? [destinationAccount] : []} onChange={handleTypeaheadChange(setDestinationAccount)} onInputChange={setDestinationAccount} /></Form.Group></Col>
                </Row>
                <Row className="mb-3">
                    <Col md={6}><Form.Group><Form.Label>Budget</Form.Label><Typeahead id="budget" ref={budgetRef} allowNew options={budgets} placeholder="(Optional)" selected={budget ? [budget] : []} onChange={handleTypeaheadChange(setBudget)} onInputChange={setBudget} /></Form.Group></Col>
                    <Col md={6}><Form.Group><Form.Label>Category</Form.Label><Typeahead id="category" ref={categoryRef} allowNew options={categories} placeholder="(Optional)" selected={category ? [category] : []} onChange={handleTypeaheadChange(setCategory)} onInputChange={setCategory} /></Form.Group></Col>
                </Row>
                <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                    {editingTransaction && <Button variant="secondary" onClick={clearForm} className="me-md-2">Cancel</Button>}
                    <Button variant="primary" type="submit" disabled={loading || submitting}>{submitting ? <Spinner as="span" animation="border" size="sm" /> : (editingTransaction ? 'Update Transaction' : 'Add Transaction')}</Button>
                </div>
                {submitStatus === 'success' && <Alert variant="success" className="mt-3">Transaction {editingTransaction ? 'updated' : 'added'} successfully!</Alert>}
                {submitStatus === 'error' && <Alert variant="danger" className="mt-3">Failed to {editingTransaction ? 'update' : 'add'} transaction.</Alert>}
            </Form>
          </div>

          {accountActivity && <div className="mb-5"><h2 className="mb-3">Latest Account Activity</h2><Row><Col md={6} className="mb-3 mb-md-0"><AccountActivityCard title="Source" account={accountActivity.source} /></Col><Col md={6}><AccountActivityCard title="Destination" account={accountActivity.destination} /></Col></Row></div>}

          <div>
            <h2 className="mb-3">Recent Transactions</h2>
            {loading ? <div className="text-center"><Spinner animation="border" /></div> : (
              <ListGroup>
                {Object.keys(groupedTransactions).map(date => (
                    <div key={date} className="mb-3">
                        <h5 className="text-muted ps-3">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h5>
                        {groupedTransactions[date].map((trans) => {
                            const tx = trans.attributes.transactions[0];
                            const badgeInfo = typeBadges[tx.type] || { bg: 'secondary', text: 'Unknown' };
                            return (
                                <ListGroup.Item key={trans.id} className="d-flex justify-content-between align-items-center">
                                <div className="flex-grow-1">
                                    <div className="d-flex align-items-center"><Badge bg={badgeInfo.bg} className="me-2">{badgeInfo.text}</Badge><span className="fw-bold">{tx.description}</span></div>
                                    <small className="text-muted ms-2">{new Date(tx.date).toLocaleTimeString()} | {tx.source_name} {'->'} {tx.destination_name}</small>
                                </div>
                                <div className="d-flex align-items-center">
                                    <span className={`fw-bold text-nowrap ps-3 ${tx.type === 'deposit' ? 'text-success' : 'text-danger'}`}>
                                        {tx.type === 'deposit' ? '+' : '-'}{currencyFormatter.format(tx.amount)} {tx.currency_symbol}
                                    </span>
                                    <ButtonGroup className="ms-3">
                                        <Button variant="outline-secondary" size="sm" onClick={() => handleEditClick(trans)}>Edit</Button>
                                        <Button variant="outline-danger" size="sm" onClick={() => handleDelete(trans.id)}>Delete</Button>
                                    </ButtonGroup>
                                </div>
                                </ListGroup.Item>
                            );
                        })}
                    </div>
                ))}
              </ListGroup>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
}