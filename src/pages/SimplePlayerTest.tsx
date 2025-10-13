/**
 * SimplePlayerTest - Direct test of PlayerPageNew with hardcoded content
 */

import { PlayerPageNew } from './PlayerPageNew';

export function SimplePlayerTest() {
  const handleBack = () => {
    window.location.href = '/';
  };

  return (
    <PlayerPageNew
      contentId="tmdb:550"
      contentType="movie"
      title="Fight Club"
      poster="https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
      backdrop="https://image.tmdb.org/t/p/w1920_and_h800_multi_faces/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg"
      onBack={handleBack}
    />
  );
}
