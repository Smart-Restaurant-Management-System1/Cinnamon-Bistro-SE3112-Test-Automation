using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using ReservationService.Controllers;
using IdentityRoles = IdentityService.Models.AppRoles;
using ReservationRoles = ReservationService.Models.AppRoles;
using ReservationPolicies = ReservationService.Models.AppPolicies;

namespace CinnamonBistro.UnitTests.Authorization;

/// <summary>
/// Authorization tests against the real controllers' [Authorize] metadata. The role semantics of
/// [Authorize(Roles = "...")] (authenticated AND in any listed role) are evaluated against crafted principals.
/// Policy definitions live in Program.cs and need a host to evaluate, so for policy-protected controllers
/// only the policy name is asserted (see README limitations).
/// </summary>
public class RoleAuthorizationTests
{
    private static ClaimsPrincipal Authenticated(params string[] roles) =>
        new(new ClaimsIdentity(roles.Select(r => new Claim(ClaimTypes.Role, r)), authenticationType: "Bearer"));

    private static ClaimsPrincipal Anonymous() => new(new ClaimsIdentity());

    private static AuthorizeAttribute RequireAuthorize(Type controller) =>
        Assert.Single(controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true));

    /// <summary>Mirrors ASP.NET's rule for the Roles property: must be authenticated and in at least one listed role.</summary>
    private static bool Allows(AuthorizeAttribute attribute, ClaimsPrincipal user) =>
        user.Identity?.IsAuthenticated == true &&
        (attribute.Roles ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(user.IsInRole);

    // ---------- Role-protected controllers ----------

    [Theory]
    [InlineData(typeof(OrderCartController), ReservationRoles.Customer)]
    [InlineData(typeof(CustomerMenuController), ReservationRoles.Customer)]
    [InlineData(typeof(AdminAuditLogsController), ReservationRoles.Admin)]
    [InlineData(typeof(IdentityService.Controllers.AdminUsersController), IdentityRoles.Admin)]
    public void Controller_AllowsOnlyItsDeclaredRole(Type controller, string allowedRole)
    {
        var attribute = RequireAuthorize(controller);

        Assert.Equal(allowedRole, attribute.Roles);
        Assert.True(Allows(attribute, Authenticated(allowedRole)));
    }

    [Theory]
    [InlineData(typeof(OrderCartController), "Admin")]
    [InlineData(typeof(OrderCartController), "KitchenStaff")]
    [InlineData(typeof(AdminAuditLogsController), "Customer")]
    [InlineData(typeof(AdminAuditLogsController), "KitchenStaff")]
    [InlineData(typeof(IdentityService.Controllers.AdminUsersController), "Customer")]
    public void Controller_RejectsAuthenticatedUserWithWrongRole(Type controller, string wrongRole)
    {
        Assert.False(Allows(RequireAuthorize(controller), Authenticated(wrongRole)));
    }

    [Theory]
    [InlineData(typeof(OrderCartController))]
    [InlineData(typeof(CustomerMenuController))]
    [InlineData(typeof(AdminAuditLogsController))]
    [InlineData(typeof(IdentityService.Controllers.AdminUsersController))]
    public void Controller_RejectsUnauthenticatedAndRolelessUsers(Type controller)
    {
        var attribute = RequireAuthorize(controller);

        Assert.False(Allows(attribute, Anonymous()));
        Assert.False(Allows(attribute, Authenticated()));
    }

    [Fact]
    public void Controller_RoleCheckIsCaseSensitive_SoLowerCaseRoleClaimIsRejected()
    {
        // ClaimsPrincipal.IsInRole uses ordinal comparison, so "customer" != "Customer".
        Assert.False(Allows(RequireAuthorize(typeof(OrderCartController)), Authenticated("customer")));
    }

    // ---------- Policy-protected controllers ----------

    [Theory]
    [InlineData(typeof(AdminOrdersController))]
    [InlineData(typeof(KitchenQueueController))]
    public void StaffControllers_RequireTheStaffPolicy(Type controller)
    {
        var attribute = RequireAuthorize(controller);

        Assert.Equal(ReservationPolicies.RequireStaff, attribute.Policy);
        Assert.Null(attribute.Roles);
    }

    // ---------- Role / policy name contract (tokens and [Authorize] strings must agree across services) ----------

    [Fact]
    public void RoleNames_AreIdenticalInIdentityAndReservationServices()
    {
        Assert.Equal(IdentityRoles.Admin, ReservationRoles.Admin);
        Assert.Equal(IdentityRoles.Customer, ReservationRoles.Customer);
        Assert.Equal(IdentityRoles.KitchenStaff, ReservationRoles.KitchenStaff);
    }

    [Fact]
    public void RoleNames_HaveTheExpectedLiteralValues()
    {
        Assert.Equal("Admin", IdentityRoles.Admin);
        Assert.Equal("Customer", IdentityRoles.Customer);
        Assert.Equal("KitchenStaff", IdentityRoles.KitchenStaff);
    }
}
