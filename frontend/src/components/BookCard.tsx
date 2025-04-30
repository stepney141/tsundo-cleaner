import React from 'react';
import styled from 'styled-components';
import { Book, BookType } from '../types/Book';

interface BookCardProps {
  book: Book;
  onClick?: () => void;
  bookType?: BookType;
}

/**
 * 書籍情報を表示するカードコンポーネント
 */
const BookCard: React.FC<BookCardProps> = ({ book, onClick, bookType }) => {
  return (
    <CardContainer onClick={onClick}>
      <BookTitle>{book.book_title}</BookTitle>
      <BookInfo>
        <Author>{book.author}</Author>
        <Publisher>{book.publisher}</Publisher>
        {book.published_date && <PublishDate>{book.published_date}</PublishDate>}
      </BookInfo>
      <LibraryStatus>
        {book.exist_in_UTokyo && <LibraryBadge color="#88CCFF">東大所蔵</LibraryBadge>}
        {book.exist_in_Sophia && <LibraryBadge color="#AADDAA">上智所蔵</LibraryBadge>}
        {bookType && (
          <BookTypeBadge 
            color={bookType === 'stacked' ? '#9F22E2' : '#E25822'}
          >
            {bookType === 'stacked' ? '積読本' : '読みたい本'}
          </BookTypeBadge>
        )}
      </LibraryStatus>
      {book.description && book.description.length > 0 && (
        <Description>
          {book.description.length > 150
            ? `${book.description.substring(0, 150)}...`
            : book.description}
        </Description>
      )}
    </CardContainer>
  );
};

const CardContainer = styled.div`
  padding: 16px;
  margin: 12px 0;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background-color: #ffffff;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const BookTitle = styled.h3`
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
`;

const BookInfo = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
`;

const Author = styled.span``;

const Publisher = styled.span`
  &::before {
    content: '・';
    margin-right: 4px;
  }
`;

const PublishDate = styled.span`
  &::before {
    content: '・';
    margin-right: 4px;
  }
`;

const LibraryStatus = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;

const LibraryBadge = styled.span<{ color: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background-color: ${(props) => props.color};
  color: #fff;
`;

const BookTypeBadge = styled.span<{ color: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  background-color: ${(props) => props.color};
  color: #fff;
  font-weight: 500;
`;

const Description = styled.p`
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #666;
  line-height: 1.4;
`;

export default BookCard;
