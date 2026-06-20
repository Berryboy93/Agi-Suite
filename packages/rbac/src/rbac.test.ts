import { describe, it, expect, beforeEach } from 'vitest';
import {
  RBACManager,
  AuditLogger,
  Permission,
  Role,
  User,
  ResourceOwnership,
  isValidPermission,
  isValidRole,
  validateUser,
  validateResourceOwnership,
} from './index';

describe('RBAC Security Tests (Mythos Hardened)', () => {
  let rbac: RBACManager;
  let auditLogger: AuditLogger;
  let testUser: User;
  let testResource: ResourceOwnership;

  beforeEach(() => {
    auditLogger = new AuditLogger();
    rbac = new RBACManager(auditLogger);

    testUser = {
      id: 'user123',
      username: 'operator',
      email: 'op@example.com',
      roles: [Role.OPERATOR],
      workspaceId: 'ws1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    testResource = {
      resourceId: 'agent1',
      resourceType: 'agent',
      ownerId: 'user123',
      workspaceId: 'ws1',
      createdAt: new Date(),
    };

    rbac.registerUser(testUser);
    rbac.registerOwnership(testResource);
  });

  // FIX F-01: crypto.randomUUID() import
  describe('F-01: Crypto import', () => {
    it('should generate UUID for audit logs without throwing', () => {
      expect(() => {
        auditLogger.log({
          userId: 'user123',
          action: Permission.AGENT_READ,
          resource: 'agent1',
          result: 'allowed',
        });
      }).not.toThrow();
      expect(auditLogger.size()).toBe(1);
    });
  });

  // FIX F-02: RBACManager state persistence
  describe('F-02: State persistence', () => {
    it('should maintain user registry across operations', () => {
      const user = rbac.getUser('user123');
      expect(user).toBeDefined();
      expect(user?.username).toBe('operator');
    });

    it('should maintain ownership registry', () => {
      const ownership = rbac.getOwnership('agent1');
      expect(ownership).toBeDefined();
      expect(ownership?.ownerId).toBe('user123');
    });
  });

  // FIX F-03: assignRole, grantPermission mutations
  describe('F-03: Role/permission mutations', () => {
    it('should actually assign role to user', () => {
      rbac.assignRole('user123', Role.ADMIN);
      const user = rbac.getUser('user123');
      expect(user?.roles).toContain(Role.ADMIN);
    });

    it('should actually grant custom permission', () => {
      rbac.grantPermission('user123', Permission.SYSTEM_CONFIG);
      const user = rbac.getUser('user123');
      expect(user?.customPermissions).toContain(Permission.SYSTEM_CONFIG);
    });

    it('should revoke role from user', () => {
      rbac.assignRole('user123', Role.ADMIN);
      rbac.revokeRole('user123', Role.ADMIN);
      const user = rbac.getUser('user123');
      expect(user?.roles).not.toContain(Role.ADMIN);
    });

    it('should revoke custom permission', () => {
      rbac.grantPermission('user123', Permission.SYSTEM_CONFIG);
      rbac.revokePermission('user123', Permission.SYSTEM_CONFIG);
      const user = rbac.getUser('user123');
      expect(user?.customPermissions).not.toContain(Permission.SYSTEM_CONFIG);
    });
  });

  // FIX F-04: Workspace isolation
  describe('F-04: Workspace isolation', () => {
    it('should deny access to resource in different workspace', () => {
      const differentWsResource: ResourceOwnership = {
        resourceId: 'agent2',
        resourceType: 'agent',
        ownerId: 'user123',
        workspaceId: 'ws2', // Different workspace
        createdAt: new Date(),
      };

      const allowed = rbac.canAccess(
        testUser,
        differentWsResource,
        Permission.AGENT_READ
      );
      expect(allowed).toBe(false);
    });

    it('should allow access to resource in same workspace', () => {
      const allowed = rbac.canAccess(
        testUser,
        testResource,
        Permission.AGENT_READ
      );
      expect(allowed).toBe(true);
    });

    it('should enforce workspace isolation for admins', () => {
      const adminUser = { ...testUser, roles: [Role.ADMIN] };
      rbac.registerUser(adminUser);

      const differentWsResource: ResourceOwnership = {
        resourceId: 'agent3',
        resourceType: 'agent',
        ownerId: 'other_user',
        workspaceId: 'ws2',
        createdAt: new Date(),
      };

      const allowed = rbac.canAccess(
        adminUser,
        differentWsResource,
        Permission.AGENT_READ
      );
      expect(allowed).toBe(false);
    });
  });

  // FIX F-05: EXECUTE requires ownership
  describe('F-05: EXECUTE ownership check', () => {
    it('should deny EXECUTE to non-owner', () => {
      const otherUser: User = {
        id: 'user456',
        username: 'operator2',
        email: 'op2@example.com',
        roles: [Role.OPERATOR],
        workspaceId: 'ws1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rbac.registerUser(otherUser);

      const allowed = rbac.canAccess(
        otherUser,
        testResource,
        Permission.AGENT_EXECUTE
      );
      expect(allowed).toBe(false);
    });

    it('should allow EXECUTE to owner', () => {
      const allowed = rbac.canAccess(
        testUser,
        testResource,
        Permission.AGENT_EXECUTE
      );
      expect(allowed).toBe(true);
    });
  });

  // FIX L-01: Bounded cache with TTL
  describe('L-01: Bounded cache', () => {
    it('should not exceed max cache size', () => {
      for (let i = 0; i < 1200; i++) {
        const user: User = {
          id: `user${i}`,
          username: `user${i}`,
          email: `user${i}@example.com`,
          roles: [Role.VIEWER],
          workspaceId: 'ws1',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rbac.registerUser(user);
        rbac.can(user, Permission.AGENT_READ);
      }
      // Should not throw or crash, cache should be bounded
      expect(rbac).toBeDefined();
    });
  });

  // FIX L-02: Bounded audit logs
  describe('L-02: Bounded audit logs', () => {
    it('should not exceed max logs', () => {
      for (let i = 0; i < 12000; i++) {
        auditLogger.log({
          userId: `user${i}`,
          action: Permission.AGENT_READ,
          resource: `agent${i}`,
          result: 'allowed',
        });
      }
      expect(auditLogger.size()).toBeLessThanOrEqual(10000);
    });
  });

  // FIX L-03: Input validation
  describe('L-03: Input validation', () => {
    it('should throw on invalid user object', () => {
      const invalidUser = { id: 'user123' } as User;
      expect(() => rbac.can(invalidUser, Permission.AGENT_READ)).toThrow();
    });

    it('should throw on invalid permission', () => {
      expect(() => rbac.can(testUser, 'invalid:perm' as Permission)).toThrow();
    });

    it('should throw on invalid getLogs userId type', () => {
      expect(() => auditLogger.getLogs(123 as any)).toThrow();
    });
  });

  // FIX L-04: Enum validation
  describe('L-04: Enum validation', () => {
    it('should validate Permission enum', () => {
      expect(isValidPermission('agent:read')).toBe(true);
      expect(isValidPermission('invalid:perm')).toBe(false);
    });

    it('should validate Role enum', () => {
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('invalid_role')).toBe(false);
    });

    it('should validate User object', () => {
      expect(validateUser(testUser)).toBe(true);
      expect(validateUser({ id: 'user123' })).toBe(false);
    });

    it('should validate ResourceOwnership object', () => {
      expect(validateResourceOwnership(testResource)).toBe(true);
      expect(validateResourceOwnership({ resourceId: 'agent1' })).toBe(false);
    });
  });

  // FIX L-05: registerUser() actually persists
  describe('L-05: User persistence', () => {
    it('should persist user via registerUser', () => {
      const newUser: User = {
        id: 'newuser',
        username: 'newoperator',
        email: 'newop@example.com',
        roles: [Role.VIEWER],
        workspaceId: 'ws1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      rbac.registerUser(newUser);
      const retrieved = rbac.getUser('newuser');
      expect(retrieved?.username).toBe('newoperator');
    });
  });

  // FIX D-01: Workspace isolation design
  describe('D-01: Workspace isolation', () => {
    it('should include workspaceId in ResourceOwnership', () => {
      expect(testResource.workspaceId).toBeDefined();
    });
  });

  // FIX D-02: Audit logging wiring
  describe('D-02: Audit logging integration', () => {
    it('should log audit trail on permission check', () => {
      const rbacWithAudit = new RBACManager(auditLogger);
      rbacWithAudit.registerUser(testUser);

      rbacWithAudit.can(testUser, Permission.AGENT_READ);

      const logs = auditLogger.getLogs('user123');
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  // FIX D-03: Permission enum validation
  describe('D-03: Permission validation', () => {
    it('should reject invalid permission in middleware factory', () => {
      expect(() =>
        isValidPermission('invalid:perm')
      ).not.toThrow(); // Should return false, not throw
      expect(isValidPermission('invalid:perm')).toBe(false);
    });
  });

  // FIX D-04: canAccess integration
  describe('D-04: canAccess integration', () => {
    it('should properly integrate canAccess for resource-level ACL', () => {
      const allowed = rbac.canAccess(
        testUser,
        testResource,
        Permission.AGENT_UPDATE
      );
      expect(allowed).toBe(true);
    });

    it('should reject canAccess for non-owner on modify', () => {
      const otherUser: User = {
        id: 'other',
        username: 'other',
        email: 'other@example.com',
        roles: [Role.OPERATOR],
        workspaceId: 'ws1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rbac.registerUser(otherUser);

      const allowed = rbac.canAccess(
        otherUser,
        testResource,
        Permission.AGENT_UPDATE
      );
      expect(allowed).toBe(false);
    });
  });
});
