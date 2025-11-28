import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from graph_db_config import get_graphdb

logger = logging.getLogger(__name__)


class UserRole:
    """User role constants"""

    ADMIN = "admin"
    NON_ADMIN = "non_admin"

    @staticmethod
    def all_roles() -> List[str]:
        return [UserRole.ADMIN, UserRole.NON_ADMIN]

    @staticmethod
    def is_valid(role: str) -> bool:
        return role in UserRole.all_roles()


class UserManager:
    """Manage users and their roles with Neo4j Graph Database"""

    def __init__(self):
        self.graph_db = get_graphdb()
        self._ensure_first_user_is_admin()

    def _ensure_first_user_is_admin(self):
        """Ensure the first user in the system is an admin"""
        try:
            users = self.get_all_users()
            if len(users) == 0:
                logger.info(
                    "📝 No users found. First user will be set as admin automatically."
                )
        except Exception as e:
            logger.warning(f"Could not check existing users: {e}")

    def save_user(self, user_data: Dict[str, Any]) -> bool:
        """
        Save or update user data in Neo4j

        Args:
            user_data: Dictionary containing user information
                Required: sub (user ID), name
                Optional: email, role, auth_method, etc.

        Returns:
            True if successful, False otherwise
        """
        try:
            user_id = user_data.get("sub")
            if not user_id:
                logger.error("Cannot save user: missing 'sub' (user ID)")
                return False

            # Check if this is the first user
            existing_users = self.get_all_users()
            is_first_user = len(existing_users) == 0

            # Get existing user to preserve role if not explicitly set
            existing_user = self.get_user(user_id)

            # Determine role
            if "role" in user_data:
                role = user_data["role"]
            elif existing_user:
                # Preserve existing role
                role = existing_user.get("role", UserRole.NON_ADMIN)
            elif is_first_user:
                # First user is admin
                role = UserRole.ADMIN
                logger.info(f"🔐 First user '{user_data.get('name')}' set as ADMIN")
            else:
                # Default to non-admin
                role = UserRole.NON_ADMIN

            # Validate role
            if not UserRole.is_valid(role):
                logger.warning(f"Invalid role '{role}', defaulting to non_admin")
                role = UserRole.NON_ADMIN

            # Save to Neo4j
            with self.graph_db.get_session() as session:
                query = """
                MERGE (u:User {user_id: $user_id})
                SET u.name = $name,
                    u.email = $email,
                    u.given_name = $given_name,
                    u.family_name = $family_name,
                    u.bemsid = $bemsid,
                    u.role = $role,
                    u.auth_method = $auth_method,
                    u.last_login = datetime($last_login),
                    u.updated_at = datetime(),
                    u.deleted = false
                RETURN u
                """

                result = session.run(
                    query,
                    user_id=user_id,
                    name=user_data.get("name", "Unknown"),
                    email=user_data.get("email", ""),
                    given_name=user_data.get("given_name", ""),
                    family_name=user_data.get("family_name", ""),
                    bemsid=user_data.get("bemsid", ""),
                    role=role,
                    auth_method=user_data.get("auth_method", "unknown"),
                    last_login=datetime.utcnow().isoformat(),
                )

                result.single()

            logger.info(
                f"✅ User saved: {user_data.get('name')} ({user_id}) - Role: {role}"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to save user: {e}")
            return False

    def get_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user by ID from Neo4j

        Args:
            user_id: User ID (sub)

        Returns:
            User data dictionary or None if not found
        """
        try:
            with self.graph_db.get_session() as session:
                query = """
                MATCH (u:User {user_id: $user_id})
                WHERE u.deleted = false
                RETURN u.user_id as sub,
                       u.name as name,
                       u.email as email,
                       u.given_name as given_name,
                       u.family_name as family_name,
                       u.bemsid as bemsid,
                       u.role as role,
                       u.auth_method as auth_method,
                       u.last_login as last_login
                """

                result = session.run(query, user_id=user_id)
                record = result.single()

                if not record:
                    return None

                return dict(record)

        except Exception as e:
            logger.error(f"Failed to get user {user_id}: {e}")
            return None

    def get_all_users(self) -> List[Dict[str, Any]]:
        """
        Get all users from Neo4j

        Returns:
            List of user data dictionaries
        """
        try:
            with self.graph_db.get_session() as session:
                query = """
                MATCH (u:User)
                WHERE u.deleted = false
                RETURN u.user_id as sub,
                       u.name as name,
                       u.email as email,
                       u.given_name as given_name,
                       u.family_name as family_name,
                       u.bemsid as bemsid,
                       u.role as role,
                       u.auth_method as auth_method,
                       u.last_login as last_login
                ORDER BY u.name
                """

                result = session.run(query)
                users = [dict(record) for record in result]
                return users

        except Exception as e:
            logger.error(f"Failed to get all users: {e}")
            return []

    def update_user_role(self, user_id: str, new_role: str) -> bool:
        """
        Update user role

        Args:
            user_id: User ID to update
            new_role: New role (admin or non_admin)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Validate role
            if not UserRole.is_valid(new_role):
                logger.error(f"Invalid role: {new_role}")
                return False

            # Get existing user
            user = self.get_user(user_id)
            if not user:
                logger.error(f"User not found: {user_id}")
                return False

            # Prevent removing the last admin
            if new_role == UserRole.NON_ADMIN and user.get("role") == UserRole.ADMIN:
                admins = self.get_users_by_role(UserRole.ADMIN)
                if len(admins) <= 1:
                    logger.error("Cannot remove last admin user")
                    return False

            # Update role in Neo4j
            with self.graph_db.get_session() as session:
                query = """
                MATCH (u:User {user_id: $user_id})
                SET u.role = $role,
                    u.updated_at = datetime()
                RETURN u
                """

                result = session.run(query, user_id=user_id, role=new_role)
                result.single()

            logger.info(f"✅ User role updated: {user_id} -> {new_role}")
            return True

        except Exception as e:
            logger.error(f"Failed to update user role: {e}")
            return False

    def get_users_by_role(self, role: str) -> List[Dict[str, Any]]:
        """
        Get all users with a specific role

        Args:
            role: Role to filter by (admin or non_admin)

        Returns:
            List of user data dictionaries
        """
        try:
            with self.graph_db.get_session() as session:
                query = """
                MATCH (u:User {role: $role})
                WHERE u.deleted = false
                RETURN u.user_id as sub,
                       u.name as name,
                       u.email as email,
                       u.given_name as given_name,
                       u.family_name as family_name,
                       u.bemsid as bemsid,
                       u.role as role,
                       u.auth_method as auth_method,
                       u.last_login as last_login
                ORDER BY u.name
                """

                result = session.run(query, role=role)
                users = [dict(record) for record in result]
                return users

        except Exception as e:
            logger.error(f"Failed to get users by role: {e}")
            return []

    def is_admin(self, user_id: str) -> bool:
        """
        Check if user is an admin

        Args:
            user_id: User ID to check

        Returns:
            True if user is admin, False otherwise
        """
        try:
            user = self.get_user(user_id)
            return user.get("role") == UserRole.ADMIN if user else False
        except Exception as e:
            logger.error(f"Failed to check admin status: {e}")
            return False

    def delete_user(self, user_id: str) -> bool:
        """
        Delete user from Neo4j (soft delete by marking as deleted)

        Args:
            user_id: User ID to delete

        Returns:
            True if successful, False otherwise
        """
        try:
            user = self.get_user(user_id)
            if not user:
                return False

            # Prevent deleting the last admin
            if user.get("role") == UserRole.ADMIN:
                admins = self.get_users_by_role(UserRole.ADMIN)
                if len(admins) <= 1:
                    logger.error("Cannot delete last admin user")
                    return False

            # Mark as deleted in Neo4j
            with self.graph_db.get_session() as session:
                query = """
                MATCH (u:User {user_id: $user_id})
                SET u.deleted = true,
                    u.deleted_at = datetime()
                RETURN u
                """

                result = session.run(query, user_id=user_id)
                result.single()

            logger.info(f"🗑️ User deleted: {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete user: {e}")
            return False


# Global user manager instance
user_manager: UserManager = None


def get_user_manager() -> UserManager:
    """Get user manager instance"""
    global user_manager
    if user_manager is None:
        user_manager = UserManager()
    return user_manager
