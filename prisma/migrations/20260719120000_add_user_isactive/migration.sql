-- Admin "deactivate a user" switch (User management admin panel).
-- Enforced in JwtStrategy.validate() so a deactivated user's existing JWT
-- stops working immediately instead of staying valid until it expires.
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
