export function LogoutButton() {
  return (
    <form action="/logout" method="post">
      <button className="logout-button" type="submit">
        تسجيل الخروج
      </button>
    </form>
  );
}
