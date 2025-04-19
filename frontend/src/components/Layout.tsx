import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * アプリケーション全体のレイアウトコンポーネント
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Container>
      <Header>
        <Logo to="/">tsundo-cleaner</Logo>
        <Navigation>
          <NavItem isActive={currentPath === '/'}>
            <NavLink to="/">ホーム</NavLink>
          </NavItem>
          <NavItem isActive={currentPath === '/search'}>
            <NavLink to="/search">書籍検索</NavLink>
          </NavItem>
          <NavItem isActive={currentPath === '/stats'}>
            <NavLink to="/stats">読書傾向</NavLink>
          </NavItem>
        </Navigation>
      </Header>

      <Main>{children}</Main>

      <Footer>
        <FooterContent>
          <p>© 2025 tsundo-cleaner - 読書メーターデータを活用した書籍推薦ツール</p>
        </FooterContent>
      </Footer>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

const Header = styled.header`
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e9ecef;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`;

const Logo = styled(Link)`
  font-size: 24px;
  font-weight: 700;
  color: #4a6da7;
  text-decoration: none;
  margin-bottom: 16px;

  @media (min-width: 768px) {
    margin-bottom: 0;
  }
`;

const Navigation = styled.nav`
  display: flex;
  gap: 16px;
`;

const NavItem = styled.div<{ isActive: boolean }>`
  padding: 8px 0;
  border-bottom: 2px solid ${(props) => (props.isActive ? '#4a6da7' : 'transparent')};
`;

const NavLink = styled(Link)`
  color: #333;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;

  &:hover {
    color: #4a6da7;
  }
`;

const Main = styled.main`
  flex: 1;
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
`;

const Footer = styled.footer`
  padding: 16px 24px;
  background-color: #f8f9fa;
  border-top: 1px solid #e9ecef;
`;

const FooterContent = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
`;

export default Layout;
