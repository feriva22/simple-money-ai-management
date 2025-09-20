import { getSession } from '../lib/session';
import TransactionPage from './TransactionPage';
import { Container, Row, Col, Button } from 'react-bootstrap';

export default async function Home() {
  const session = await getSession();

  if (!session.user) {
    return (
      <Container className="d-flex align-items-center justify-content-center" style={{ height: '100vh' }}>
        <Row>
          <Col className="text-center">
            <h1>Welcome to Money-AI</h1>
            <p>Please log in to manage your finances.</p>
            <Button href="/api/auth/login" variant="primary" size="lg">Login with Firefly III</Button>
          </Col>
        </Row>
      </Container>
    );
  }

  return <TransactionPage />;
}
