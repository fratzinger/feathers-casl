import { Application } from "../declarations";
import articles from "./articles/articles.service";
import comments from "./comments/comments.service";
import users from "./users/users.service";
// Don't remove this comment. It's needed to format import lines nicely.

export default function (app: Application): void {
  app.configure(articles);
  app.configure(comments);
  app.configure(users);
}
