import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Book, BookType } from '../types/Book';
import { bookService } from '../services/bookService';
import BookCard from './BookCard';

interface SimilarBooksProps {
  bookUrl: string;
  type?: BookType;
  limit?: number;
}

/**
 * 類似書籍一覧を表示するコンポーネント
 */
const SimilarBooks: React.FC<SimilarBooksProps> = ({ bookUrl, type = 'wish', limit = 5 }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSimilarBooks = async () => {
      if (!bookUrl) {
        setBooks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const similarBooks = await bookService.getSimilarBooks(bookUrl, type, limit);
        setBooks(similarBooks);
        setError(null);
      } catch (err) {
        console.error('類似書籍の取得に失敗しました', err);
        setError('類似書籍の取得に失敗しました。後ほど再度お試しください。');
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarBooks();
  }, [bookUrl, type, limit]);

  if (loading) {
    return <LoadingContainer>読み込み中...</LoadingContainer>;
  }

  if (error) {
    return <ErrorContainer>{error}</ErrorContainer>;
  }

  if (books.length === 0) {
    return <EmptyContainer>類似する本が見つかりませんでした。</EmptyContainer>;
  }

  return (
    <Container>
      <SectionTitle>この本に類似した本</SectionTitle>
      <BooksList>
        {books.map((book) => (
          <BookCard 
            key={book.bookmeter_url} 
            book={book} 
            bookType={book.bookType || type} 
          />
        ))}
      </BooksList>
    </Container>
  );
};

const Container = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  margin: 0 0 16px 0;
  font-size: 24px;
  font-weight: 600;
  color: #333;
`;

const BooksList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const LoadingContainer = styled.div`
  padding: 32px;
  text-align: center;
  color: #666;
`;

const ErrorContainer = styled.div`
  padding: 16px;
  background-color: #fff3f3;
  border-radius: 8px;
  color: #d32f2f;
  border: 1px solid #ffcdd2;
`;

const EmptyContainer = styled.div`
  padding: 32px;
  text-align: center;
  color: #666;
  background-color: #f5f5f5;
  border-radius: 8px;
`;

export default SimilarBooks;
